import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { parseCsvFile } from '../src/csv.ts'
import { analyzeData } from '../src/diagnosis.ts'
import { applyCleaning, cloneCsv, previewCleaning } from '../src/cleaning.ts'
import { compareData } from '../src/comparison.ts'
import { createCsvBlob } from '../src/csvExport.ts'

test('MVP flow preserves original across preview, two cleanings, comparison, download and reset', async () => {
  const bytes = readFileSync(new URL('./fixtures/mvp-flow.csv', import.meta.url))
  const original = await parseCsvFile(new File([bytes], 'mvp-flow.csv'), 'utf-8')
  const originalSnapshot = JSON.stringify(original)
  let working = cloneCsv(original)
  const initial = analyzeData(working)
  assert.equal(initial.rowCount, 4)
  assert.equal(initial.columnCount, 3)
  assert.equal(initial.missingCellCount, 1)
  assert.equal(initial.duplicateRows.length, 1)
  assert.equal(initial.columns[1].stats.mean, 29)

  const meanChoice = { method: 'fill_mean', columnIndex: 1 }
  const preview = previewCleaning(working, meanChoice)
  assert.equal(preview.canApply, true)
  assert.equal(preview.replacementValue, '29')
  assert.equal(preview.after.missingCellCount, 0)
  assert.equal(JSON.stringify(working), originalSnapshot)
  assert.equal(JSON.stringify(original), originalSnapshot)

  working = applyCleaning(working, meanChoice)
  assert.deepEqual(working.rows.map((row) => row[1]), ['25', '29', '31', '31'])
  assert.equal(analyzeData(working).rowCount, 4)
  assert.equal(analyzeData(working).missingCellCount, 0)
  assert.equal(previewCleaning(working, meanChoice).canApply, false)

  working = applyCleaning(working, { method: 'remove_duplicates', columnIndex: 0 })
  const final = analyzeData(working)
  assert.equal(final.rowCount, 3)
  assert.equal(final.missingCellCount, 0)
  assert.equal(final.duplicateRows.length, 0)
  assert.deepEqual(working.rows.map((row) => row[1]), ['25', '29', '31'])
  assert.ok(Math.abs(final.columns[1].stats.mean - 28.333333333333332) < 1e-10)
  const comparison = compareData(original, working)
  assert.equal(comparison.original.rowCount, 4)
  assert.equal(comparison.working.rowCount, 3)
  assert.equal(comparison.original.missingCellCount, 1)
  assert.equal(comparison.working.missingCellCount, 0)
  assert.equal(comparison.original.duplicateRows.length, 1)
  assert.equal(comparison.working.duplicateRows.length, 0)
  assert.equal(comparison.lossRate, 0.25)

  const downloaded = await parseCsvFile(new File([createCsvBlob(working, 'utf-8-bom')], 'mvp-flow-cleaned.csv'), 'utf-8')
  assert.deepEqual(downloaded.columns, working.columns)
  assert.deepEqual(downloaded.rows, working.rows)
  assert.equal(JSON.stringify(original), originalSnapshot)

  working = cloneCsv(original)
  assert.equal(compareData(original, working).unchanged, true)
  assert.equal(analyzeData(working).missingCellCount, 1)
  assert.equal(analyzeData(working).duplicateRows.length, 1)
})
