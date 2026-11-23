import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeData, isMissing } from '../src/diagnosis.ts'

const dataset = (columns, rows) => ({ fileName: 'test.csv', fileSize: 100, encoding: 'utf-8', columns, rows })

test('structure, missing cells, exact duplicates, and numeric statistics', () => {
  const data = dataset(['상품', '수량', '메모'], [
    ['펜', '2', ''],
    ['노트', '4', '정상'],
    ['펜', '2', ''],
    ['컵', '6', '  '],
  ])
  const result = analyzeData(data)
  assert.equal(result.rowCount, 4)
  assert.equal(result.columnCount, 3)
  assert.equal(result.missingCellCount, 3)
  assert.deepEqual(result.missingRowIndices, [0, 2, 3])
  assert.deepEqual(result.duplicateRows, [{ rowIndex: 2, originalRowIndex: 0 }])
  assert.deepEqual(result.columns.map((column) => column.name), data.columns)
  assert.equal(result.columns[2].missingRate, 3 / 4)
  assert.deepEqual(result.columns[1].stats, { validCount: 4, min: 2, max: 6, mean: 3.5, median: 3 })
  assert.equal(result.columns[0].uniqueCount, 3)
})

test('no duplicate data stays clear, with exact raw string comparison', () => {
  const result = analyzeData(dataset(['값'], [['a'], ['a '], ['A'], ['a']]))
  assert.deepEqual(result.duplicateRows, [{ rowIndex: 3, originalRowIndex: 0 }])
  assert.equal(result.columns[0].uniqueCount, 3)
  assert.deepEqual(analyzeData(dataset(['값'], [['a'], ['b']])).duplicateRows, [])
})

test('all-missing and zero-row columns have safe values', () => {
  const allMissing = analyzeData(dataset(['값'], [[''], ['  '], ['\t']]))
  assert.equal(allMissing.columns[0].type, 'empty')
  assert.equal(allMissing.columns[0].missingCount, 3)
  assert.equal(allMissing.columns[0].missingRate, 1)
  assert.equal(allMissing.columns[0].uniqueCount, 0)
  assert.equal(allMissing.columns[0].stats, null)
  const noRows = analyzeData(dataset(['값'], []))
  assert.equal(noRows.columns[0].missingRate, 0)
  assert.equal(noRows.columns[0].type, 'empty')
})

test('mixed and ambiguous values do not receive numeric statistics', () => {
  const result = analyzeData(dataset(['혼합', '식별자', '문자'], [['1', '001', 'NULL'], ['텍스트', '002', 'N/A'], ['0', '003', '0']]))
  assert.equal(result.columns[0].type, 'mixed')
  assert.equal(result.columns[0].stats, null)
  assert.equal(result.columns[1].type, 'string')
  assert.equal(result.columns[2].missingCount, 0)
  assert.equal(isMissing('0'), false)
  assert.equal(isMissing('N/A'), false)
  assert.equal(isMissing('NULL'), false)
})

test('non-finite numeric input is excluded and input remains unchanged', () => {
  const rows = Object.freeze([Object.freeze(['1e309', '1']), Object.freeze(['2', '3'])])
  const columns = Object.freeze(['혼합', '숫자'])
  const data = Object.freeze(dataset(columns, rows))
  const before = JSON.stringify(data)
  const result = analyzeData(data)
  assert.equal(result.columns[0].type, 'mixed')
  assert.equal(result.columns[0].stats, null)
  assert.equal(result.columns[1].stats.median, 2)
  assert.equal(JSON.stringify(data), before)
})
