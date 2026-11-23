import assert from 'node:assert/strict'
import test from 'node:test'
import { CsvValidationError, MAX_CSV_BYTES, parseCsvFile } from '../src/csv.ts'
import { createSampleFile } from '../src/sampleCsv.ts'

const csvFile = (content, name = 'data.csv') => new File([content], name, { type: 'text/csv' })

test('UTF-8, BOM, and sample data retain parsed values', async () => {
  const utf8 = await parseCsvFile(csvFile('이름,값\n가,1\n'), 'utf-8')
  assert.deepEqual(utf8.columns, ['이름', '값'])
  assert.deepEqual(utf8.rows, [['가', '1']])

  const bom = await parseCsvFile(csvFile('\uFEFF이름,값\n가,1'), 'utf-8')
  assert.deepEqual(bom.columns, ['이름', '값'])

  const sample = await parseCsvFile(createSampleFile(), 'utf-8')
  assert.equal(sample.rows.length, 6)
  assert.deepEqual(sample.rows[0], sample.rows[3])
  assert.equal(sample.rows[2][3], '')
})

test('CP949 can be selected for Korean bytes', async () => {
  const bytes = new Uint8Array([...Buffer.from('name,value\n'), 0xb0, 0xa1, ...Buffer.from(',1\n')])
  await assert.rejects(parseCsvFile(csvFile(bytes), 'utf-8'), CsvValidationError)
  const result = await parseCsvFile(csvFile(bytes), 'euc-kr')
  assert.equal(result.rows[0][0], '가')
})

test('empty, oversized, and malformed files are rejected', async () => {
  await assert.rejects(parseCsvFile(csvFile(''), 'utf-8'), /빈 파일/)
  await assert.rejects(parseCsvFile(csvFile('a,b\n"unclosed,1'), 'utf-8'), /파싱 오류/)
  await assert.rejects(parseCsvFile(csvFile('a,b\n1'), 'utf-8'), /컬럼 수/)
  await assert.rejects(parseCsvFile(csvFile('a,b\n1,2', 'data.txt'), 'utf-8'), /CSV 파일/)
  await assert.rejects(parseCsvFile(csvFile(new Uint8Array(MAX_CSV_BYTES + 1)), 'utf-8'), /5MB/)
})
