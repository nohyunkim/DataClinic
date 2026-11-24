import assert from 'node:assert/strict'
import test from 'node:test'
import Papa from 'papaparse'
import { CsvValidationError, MAX_CSV_BYTES, parseCsvFile } from '../src/csv.ts'
import { applyCleaning, cloneCsv, previewCleaning } from '../src/cleaning.ts'
import { compareData } from '../src/comparison.ts'
import { analyzeData } from '../src/diagnosis.ts'
import { createCsvBlob, downloadCsv, formulaRiskCount, serializeCsv } from '../src/csvExport.ts'

const file = (content, name = 'data.csv') => new File([content], name, { type: 'text/csv' })
const data = (columns, rows) => ({ fileName: 'data.csv', fileSize: 100, encoding: 'utf-8', columns, rows })

test('formula protection applies after CSV serialization without altering safe numbers or source data', async () => {
  const risky = ['=1+1', '+1', '-=1+1', '@name', '  =1+1', '\t=1+1', '\n=1+1', '\r=1+1', '"=1+1"', ',=1+1']
  const safe = ['-123', '-3.5', '-1e3', ' -123', "'=1+1", 'ordinary', '0']
  const values = [...risky, ...safe]
  const original = data(['=header', 'text'], values.map((value) => [value, 'ok']))
  const working = cloneCsv(original)
  const snapshot = JSON.stringify(working)
  const serialized = serializeCsv(working)
  const cells = Papa.parse(serialized, { delimiter: ',', skipEmptyLines: false }).data
  assert.equal(cells[0][0], "'=header")
  risky.forEach((value, index) => {
    const escaped = value.startsWith('"') || value.startsWith(',') ? value : `'${value}`
    assert.equal(cells[index + 1][0], escaped)
  })
  safe.forEach((value, index) => assert.equal(cells[risky.length + index + 1][0], value))
  assert.equal(formulaRiskCount(working), 9)
  assert.equal(JSON.stringify(working), snapshot)
  assert.deepEqual(original, working)
  const reimported = await parseCsvFile(file(createCsvBlob(working, 'utf-8-bom')), 'utf-8')
  assert.deepEqual(reimported.rows, cells.slice(1))

  const splitCells = await parseCsvFile(file('left,right\nx,=1+1\n"quoted,cell","=1+1"'), 'utf-8')
  const serializedSplit = Papa.parse(serializeCsv(splitCells), { delimiter: ',' }).data
  assert.deepEqual(serializedSplit.slice(1), [['x', "'=1+1"], ['quoted,cell', "'=1+1"]])
})

test('file validation accepts boundary sizes and valid multiline cells', async () => {
  const prefix = 'name,value\n'
  for (const size of [MAX_CSV_BYTES - 1, MAX_CSV_BYTES]) {
    const source = `${prefix}${'x'.repeat(size - prefix.length - 2)},1`
    const parsed = await parseCsvFile(file(source), 'utf-8')
    assert.equal(parsed.fileSize, size)
    assert.equal(parsed.rows[0][0].length, size - prefix.length - 2)
  }
  await assert.rejects(parseCsvFile(file(`${prefix}${'x'.repeat(MAX_CSV_BYTES)},1`), 'utf-8'), /5MB/)
  const multiline = await parseCsvFile(file('name,notes\n가,"쉼표, 그리고\n줄바꿈"'), 'utf-8')
  assert.deepEqual(multiline.rows, [['가', '쉼표, 그리고\n줄바꿈']])
})

test('invalid structure and bytes are rejected; duplicate headers remain supported', async () => {
  const invalid = [
    ['', /빈 파일/], [' \n', /빈 파일/], ['a,b', /데이터 행/],
    [',b\n1,2', /비어 있는 컬럼명/], ['a,b\n1', /컬럼 수/],
    ['a,b\n"1,2', /파싱 오류/], ['not csv data', /데이터 행/],
  ]
  for (const [content, error] of invalid) await assert.rejects(parseCsvFile(file(content), 'utf-8'), error)
  const repeated = await parseCsvFile(file('a,a\n1,2'), 'utf-8')
  assert.deepEqual(repeated.columns, ['a', 'a'])
  const manyColumns = await parseCsvFile(file(`${Array.from({ length: 1000 }, (_, i) => `c${i}`).join(',')}\n${Array(1000).fill('0').join(',')}`), 'utf-8')
  assert.equal(manyColumns.columns.length, 1000)
  await assert.rejects(parseCsvFile(file(new Uint8Array([0xff, 0xfe])), 'utf-8'), /인코딩/)
  await assert.rejects(parseCsvFile(file(new Uint8Array([0xff])), 'euc-kr'), /인코딩/)
  await assert.rejects(parseCsvFile(file('a\n1'), 'unsupported'), CsvValidationError)
})

test('CP949 Korean headers and cells survive UTF-8 and BOM exports', async () => {
  const cp949 = new Uint8Array([0xb0, 0xa1, 0x2c, 0x76, 0x0a, 0xb0, 0xa1, 0x2c, 0x31])
  await assert.rejects(parseCsvFile(file(cp949), 'utf-8'), /인코딩/)
  const parsed = await parseCsvFile(file(cp949), 'euc-kr')
  assert.deepEqual(parsed.columns, ['가', 'v'])
  assert.deepEqual(parsed.rows, [['가', '1']])
  for (const encoding of ['utf-8', 'utf-8-bom']) {
    const result = await parseCsvFile(file(createCsvBlob(parsed, encoding)), 'utf-8')
    assert.deepEqual(result.columns, parsed.columns)
    assert.deepEqual(result.rows, parsed.rows)
  }
})

test('numeric edge cases remain finite and cleaning cannot empty the dataset', () => {
  const original = data(['number', 'mixed', 'missing'], [['0', '0', ''], ['-3.5', 'text', ' '], ['1e308', '1e309', '\t'], ['-1e308', '0', '']])
  const snapshot = JSON.stringify(original)
  const report = analyzeData(original)
  assert.equal(report.columns[0].type, 'number')
  assert.ok(Object.values(report.columns[0].stats).every(Number.isFinite))
  assert.equal(report.columns[1].type, 'mixed')
  assert.equal(report.columns[1].stats, null)
  assert.equal(report.columns[2].stats, null)
  assert.equal(previewCleaning(original, { method: 'remove_missing', columnIndex: 2 }).canApply, false)
  assert.equal(previewCleaning(original, { method: 'fill_mean', columnIndex: 1 }).canApply, false)
  const duplicate = data(['value'], [['same'], ['same'], ['same']])
  const deduped = applyCleaning(duplicate, { method: 'remove_duplicates', columnIndex: 0 })
  assert.deepEqual(deduped.rows, [['same']])
  assert.equal(compareData(duplicate, deduped).lossRate, 2 / 3)
  assert.equal(JSON.stringify(original), snapshot)
})

test('download removes its temporary anchor and revokes its Blob URL', () => {
  const priorDocument = globalThis.document
  const priorWindow = globalThis.window
  const priorCreate = URL.createObjectURL
  const priorRevoke = URL.revokeObjectURL
  const events = []
  const anchor = {
    style: {},
    click() { events.push('click') },
    remove() { events.push('remove') },
  }
  try {
    globalThis.document = {
      createElement(tag) { assert.equal(tag, 'a'); return anchor },
      body: { append(element) { assert.equal(element, anchor); events.push('append') } },
    }
    globalThis.window = { setTimeout(callback, delay) { assert.equal(delay, 1000); callback() } }
    URL.createObjectURL = (blob) => { assert.ok(blob instanceof Blob); events.push('create'); return 'blob:test' }
    URL.revokeObjectURL = (url) => { assert.equal(url, 'blob:test'); events.push('revoke') }
    assert.equal(downloadCsv(data(['value'], [['1']]), 'utf-8'), 'data_cleaned.csv')
    assert.deepEqual(events, ['create', 'append', 'click', 'remove', 'revoke'])
  } finally {
    globalThis.document = priorDocument
    globalThis.window = priorWindow
    URL.createObjectURL = priorCreate
    URL.revokeObjectURL = priorRevoke
  }
})
