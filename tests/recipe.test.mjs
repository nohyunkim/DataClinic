import assert from 'node:assert/strict'
import test from 'node:test'
import { applyCleaning, cloneCsv } from '../src/cleaning.ts'
import { parseRecipe, previewRecipe, serializeRecipe, stepFromChoice } from '../src/recipe.ts'
import { analyzeData } from '../src/diagnosis.ts'
import { serializeCsv } from '../src/csvExport.ts'

const data = (columns, rows) => ({ fileName: 'synthetic.csv', fileSize: 1, encoding: 'utf-8', columns, rows })
const choice = (method, columnIndex = 0) => ({ method, columnIndex })

test('applied steps retain order through JSON round trip; replay matches preview, comparison, and CSV export', () => {
  const original = data(['amount', 'group'], [['2', 'A'], ['', 'A'], ['4', 'B'], ['4', 'B'], ['6', '']])
  const snapshot = JSON.stringify(original)
  let working = cloneCsv(original)
  const steps = []
  for (const selected of [choice('fill_mean'), choice('remove_duplicates'), choice('remove_missing', 1)]) {
    const before = working
    working = applyCleaning(working, selected)
    steps.push(stepFromChoice(before, selected, steps.length + 1))
  }
  const json = serializeRecipe(steps)
  assert.deepEqual(JSON.parse(json).steps.map((step) => step.method), ['fill_mean', 'remove_duplicates', 'remove_missing'])
  assert.equal(json.includes('"rows"'), false)
  assert.equal(json.includes('"replacementValue"'), false)
  const loaded = parseRecipe(json)
  const preview = previewRecipe(original, loaded)
  assert.equal(preview.error, null)
  assert.deepEqual(preview.result, working)
  assert.equal(preview.impacts.length, 3)
  assert.equal(analyzeData(preview.result).duplicateRows.length, 0)
  assert.match(serializeCsv(preview.result), /amount,group/)
  assert.equal(JSON.stringify(original), snapshot)
})

test('replay on another CSV recalculates mean and skips a step with no targets visibly', () => {
  const source = data(['value', 'tag'], [['1', 'a'], ['', 'b'], ['3', 'b']])
  const recipe = parseRecipe(serializeRecipe([
    stepFromChoice(source, choice('fill_mean'), 1),
    stepFromChoice(source, choice('remove_duplicates'), 2),
  ]))
  const target = data(['value', 'tag'], [['10', 'a'], ['', 'b'], ['30', 'c']])
  const preview = previewRecipe(target, recipe)
  assert.equal(preview.error, null)
  assert.equal(preview.result.rows[1][0], '20')
  assert.deepEqual(preview.impacts.map((impact) => impact.status), ['applied', 'skipped'])
  assert.deepEqual(target.rows[1], ['', 'b'])
})

test('invalid JSON, version, method, parameters, count, and size are rejected', () => {
  assert.throws(() => parseRecipe('{'), /JSON/)
  assert.throws(() => parseRecipe('{"schemaVersion":2,"steps":[]}'), /스키마/)
  assert.throws(() => parseRecipe(JSON.stringify({ schemaVersion: 1, steps: [] })), /1~100/)
  const source = data(['x'], [['a'], ['']])
  const valid = JSON.parse(serializeRecipe([stepFromChoice(source, choice('fill_mode'), 1)]))
  valid.steps[0].method = 'eval'
  assert.throws(() => parseRecipe(JSON.stringify(valid)), /정제 작업/)
  valid.steps[0].method = 'fill_mode'
  valid.steps[0].column.index = -1
  assert.throws(() => parseRecipe(JSON.stringify(valid)), /컬럼/)
  assert.throws(() => parseRecipe(' '.repeat(65537)), /64KB/)
})

test('missing and duplicate column positions reject replay', () => {
  const source = data(['id', 'name', 'name'], [['1', 'a', ''], ['2', 'b', 'x']])
  const recipe = parseRecipe(serializeRecipe([stepFromChoice(source, choice('fill_mode', 2), 1)]))
  assert.match(previewRecipe(data(['id', 'name', 'other'], source.rows), recipe).error, /위치/)
  assert.match(previewRecipe(data(['id', 'other', 'name'], source.rows), recipe).error, /위치/)
  assert.match(previewRecipe(data(['id', 'name'], [['1', '']]), recipe).error, /위치/)
  assert.equal(previewRecipe(source, recipe).result.rows[0][2], 'x')
})

test('type or middle-step failure leaves input unchanged and returns no partial result', () => {
  const source = data(['value', 'label'], [['1', '2'], ['', ''], ['3', '4']])
  const recipe = parseRecipe(serializeRecipe([
    stepFromChoice(source, choice('fill_mean'), 1),
    stepFromChoice(source, choice('fill_mean', 1), 2),
  ]))
  const target = data(['value', 'label'], [['10', 'A'], ['', ''], ['30', 'C']])
  const snapshot = JSON.stringify(target)
  const preview = previewRecipe(target, recipe)
  assert.equal(preview.result, null)
  assert.match(preview.error, /2단계/)
  assert.equal(preview.impacts[0].status, 'applied')
  assert.equal(JSON.stringify(target), snapshot)
  const incompatible = data(['value', 'label'], [['text', 'A'], ['', 'B']])
  assert.equal(previewRecipe(incompatible, recipe).result, null)
  assert.match(previewRecipe(incompatible, recipe).error, /1단계/)
})

test('reset clears history and restores a separate copy of original', () => {
  const original = data(['x'], [['A'], [''], ['B']])
  let history = []
  let working = applyCleaning(cloneCsv(original), choice('fill_mode'))
  history = [stepFromChoice(original, choice('fill_mode'), 1)]
  assert.equal(history.length, 1)
  working = cloneCsv(original)
  history = []
  assert.deepEqual(working, original)
  assert.notEqual(working.rows, original.rows)
  assert.equal(history.length, 0)
})
