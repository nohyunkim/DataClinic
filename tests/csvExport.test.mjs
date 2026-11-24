import assert from 'node:assert/strict'
import test from 'node:test'
import Papa from 'papaparse'
import { parseCsvFile } from '../src/csv.ts'
import { applyCleaning, cloneCsv } from '../src/cleaning.ts'
import { cleanedFileName, createCsvBlob, formulaRiskCount, serializeCsv } from '../src/csvExport.ts'

const dataset = (columns, rows, fileName = '한글.csv') => ({ fileName, fileSize: 100, encoding: 'euc-kr', columns, rows })

test('UTF-8 export preserves Korean, punctuation, line breaks, empty values and column order', async () => {
  const data = dataset(['이름', '설명', '빈 칸'], [['가', '쉼표, 포함', ''], ['나', '큰따옴표 "인용"\n다음 줄', '0']])
  const text = serializeCsv(data)
  const parsed = await parseCsvFile(new File([text], 'roundtrip.csv'), 'utf-8')
  assert.deepEqual(parsed.columns, data.columns)
  assert.deepEqual(parsed.rows, data.rows)
  assert.equal(createCsvBlob(data, 'utf-8').type, 'text/csv;charset=utf-8')
  assert.equal(cleanedFileName(data.fileName), '한글_cleaned.csv')
})

test('UTF-8 BOM option prefixes BOM and remains readable', async () => {
  const data = dataset(['한글'], [['테스트']])
  const blob = createCsvBlob(data, 'utf-8-bom')
  const bytes = new Uint8Array(await blob.arrayBuffer())
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf])
  const parsed = await parseCsvFile(new File([blob], 'bom.csv'), 'utf-8')
  assert.deepEqual(parsed.columns, data.columns)
  assert.deepEqual(parsed.rows, data.rows)
})

test('formula-like prefixes are escaped in headers and cells without changing source', () => {
  const values = ['=1+1', '+SUM(A1)', '-42', '@name', '  =1+1', '\t=1', '\n@name', 'safe', '0']
  const data = dataset(['=헤더', '값'], values.map((value) => [value, '일반']))
  const snapshot = JSON.stringify(data)
  const text = serializeCsv(data)
  const parsed = Papa.parse(text, { delimiter: ',', skipEmptyLines: false }).data
  assert.equal(formulaRiskCount(data), 7)
  assert.equal(parsed[0][0], "'=헤더")
  values.forEach((value, index) => {
    const risky = index < 7 && value !== '-42'
    assert.equal(parsed[index + 1][0], risky ? `'${value}` : value)
  })
  assert.equal(JSON.stringify(data), snapshot)
})

test('download serialization uses all rows of current work, including rows beyond preview', async () => {
  const original = dataset(['값'], Array.from({ length: 25 }, (_, index) => [String(index + 1)]))
  original.rows.push([''])
  const working = applyCleaning(cloneCsv(original), { method: 'fill_mean', columnIndex: 0 })
  const parsed = await parseCsvFile(new File([createCsvBlob(working, 'utf-8')], 'result.csv'), 'utf-8')
  assert.equal(parsed.rows.length, 26)
  assert.equal(parsed.rows[25][0], '13')
  assert.equal(original.rows[25][0], '')
})
