import assert from 'node:assert/strict'
import test from 'node:test'
import { applyCleaning, cloneCsv } from '../src/cleaning.ts'
import { compareData } from '../src/comparison.ts'

const dataset = (columns, rows) => ({ fileName: 'source.csv', fileSize: 100, encoding: 'utf-8', columns, rows })

test('no cleaning reports identical original and work', () => {
  const original = dataset(['값'], [['0'], ['1']])
  const result = compareData(original, cloneCsv(original))
  assert.equal(result.unchanged, true)
  assert.equal(result.lostRows, 0)
  assert.equal(result.lossRate, 0)
  assert.equal(result.original.columns[0].stats.mean, 0.5)
})

test('mean fill compares the initial original with current work', () => {
  const original = dataset(['값'], [['1'], [''], ['3']])
  const snapshot = JSON.stringify(original)
  const working = applyCleaning(cloneCsv(original), { method: 'fill_mean', columnIndex: 0 })
  const result = compareData(original, working)
  assert.equal(result.original.missingCellCount, 1)
  assert.equal(result.working.missingCellCount, 0)
  assert.equal(result.original.columns[0].stats.mean, 2)
  assert.equal(result.working.columns[0].stats.mean, 2)
  assert.equal(result.unchanged, false)
  assert.equal(JSON.stringify(original), snapshot)
})

test('missing-row removal and duplicate removal report row loss', () => {
  const original = dataset(['이름', '값'], [['가', '1'], ['', '2'], ['가', '1'], ['나', '3']])
  const withoutMissing = applyCleaning(cloneCsv(original), { method: 'remove_missing', columnIndex: 0 })
  const first = compareData(original, withoutMissing)
  assert.equal(first.original.rowCount, 4)
  assert.equal(first.working.rowCount, 3)
  assert.equal(first.lostRows, 1)
  assert.equal(first.lossRate, 0.25)
  assert.equal(first.working.duplicateRows.length, 1)

  const withoutDuplicates = applyCleaning(withoutMissing, { method: 'remove_duplicates', columnIndex: 0 })
  const second = compareData(original, withoutDuplicates)
  assert.equal(second.working.rowCount, 2)
  assert.equal(second.lostRows, 2)
  assert.equal(second.lossRate, 0.5)
  assert.equal(second.original.duplicateRows.length, 1)
  assert.equal(second.working.duplicateRows.length, 0)
  assert.equal(original.rows.length, 4)
})

test('reopening comparison after another cleaning uses new work and same original', () => {
  const original = dataset(['상품', '분류'], [['펜', ''], ['펜', '문구'], ['펜', '문구']])
  const filled = applyCleaning(cloneCsv(original), { method: 'fill_mode', columnIndex: 1 })
  const first = compareData(original, filled)
  const deduped = applyCleaning(filled, { method: 'remove_duplicates', columnIndex: 0 })
  const second = compareData(original, deduped)
  assert.equal(first.original.missingCellCount, 1)
  assert.equal(second.original.missingCellCount, 1)
  assert.equal(first.working.rowCount, 3)
  assert.equal(second.working.rowCount, 1)
  assert.equal(second.lossRate, 2 / 3)
})
