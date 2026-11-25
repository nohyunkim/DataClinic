import assert from 'node:assert/strict'
import test from 'node:test'
import { parseCsvFile } from '../src/csv.ts'
import { analyzeData } from '../src/diagnosis.ts'
import { previewCleaning } from '../src/cleaning.ts'
import { compareData } from '../src/comparison.ts'
import { createCsvBlob, serializeCsv } from '../src/csvExport.ts'
import { columnLabels } from '../src/columnLabel.ts'

const dataset = (columns, rows) => ({ fileName: 'columns.csv', fileSize: 0, encoding: 'utf-8', columns, rows })

test('duplicate column names retain distinct positions through diagnosis, cleaning, comparison and export', async () => {
  const original = dataset(['값', '값', '메모'], [['1', '가', 'a'], ['2', '', 'b'], ['3', '가', 'c']])
  const snapshot = JSON.stringify(original)
  const parsed = await parseCsvFile(new File([serializeCsv(original)], original.fileName), 'utf-8')
  assert.deepEqual(parsed.columns, original.columns)
  assert.deepEqual(columnLabels(parsed.columns), ['값 (1열)', '값 (2열)', '메모'])
  assert.deepEqual(parsed.rows, original.rows)
  const diagnosed = analyzeData(parsed)
  assert.equal(diagnosed.columns[0].type, 'number')
  assert.equal(diagnosed.columns[0].missingCount, 0)
  assert.equal(diagnosed.columns[1].type, 'string')
  assert.deepEqual(diagnosed.columns[1].missingRowIndices, [1])
  const preview = previewCleaning(parsed, { method: 'fill_mode', columnIndex: 1 }, diagnosed)
  assert.equal(preview.canApply, true)
  assert.deepEqual(preview.result.rows, [['1', '가', 'a'], ['2', '가', 'b'], ['3', '가', 'c']])
  assert.equal(compareData(parsed, preview.result).working.missingCellCount, 0)
  const downloaded = await parseCsvFile(new File([createCsvBlob(preview.result, 'utf-8-bom')], 'download.csv'), 'utf-8')
  assert.deepEqual(downloaded.columns, original.columns)
  assert.deepEqual(downloaded.rows, preview.result.rows)
  assert.equal(JSON.stringify(original), snapshot)
  assert.deepEqual(parsed.rows, original.rows)
})

test('1,000 columns retain far-right column selection and values through export', async () => {
  const columns = Array.from({ length: 1000 }, (_, index) => index === 999 ? 'c0' : `c${index}`)
  const rows = Array.from({ length: 24 }, (_, rowIndex) =>
    columns.map((_, columnIndex) => columnIndex === 999 && rowIndex === 3 ? '' : `${columnIndex}:${rowIndex}`))
  rows[4][999] = rows[0][999]
  const original = dataset(columns, rows)
  const parsed = await parseCsvFile(new File([serializeCsv(original)], 'wide.csv'), 'utf-8')
  assert.equal(parsed.columns.length, 1000)
  assert.equal(parsed.columns[0], parsed.columns[999])
  assert.equal(columnLabels(parsed.columns)[0], 'c0 (1열)')
  assert.equal(columnLabels(parsed.columns)[999], 'c0 (1000열)')
  const preview = previewCleaning(parsed, { method: 'fill_mode', columnIndex: 999 })
  assert.equal(preview.canApply, true)
  assert.equal(preview.result.rows[3][999], rows[0][999])
  assert.equal(preview.result.rows[3][0], rows[3][0])
  assert.equal(preview.result.columns[999], 'c0')
  const downloaded = await parseCsvFile(new File([createCsvBlob(preview.result, 'utf-8')], 'wide-cleaned.csv'), 'utf-8')
  assert.deepEqual(downloaded.columns, columns)
  assert.deepEqual(downloaded.rows, preview.result.rows)
  assert.deepEqual(original.rows, rows)
})
