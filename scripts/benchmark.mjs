// Run with: node --expose-gc --experimental-strip-types scripts/benchmark.mjs
// Synthetic, deterministic CSV only. Timings are for Node.js, not a browser.
import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { MAX_CSV_BYTES, parseCsvFile } from '../src/csv.ts'
import { analyzeData } from '../src/diagnosis.ts'
import { applyCleaning, cloneCsv, previewCleaning } from '../src/cleaning.ts'
import { compareData } from '../src/comparison.ts'
import { serializeCsv } from '../src/csvExport.ts'

const MiB = 1024 * 1024
const repetitions = 5
const scenarios = [
  { name: 'rows-100k', target: 100 * 1024, kind: 'rows' },
  { name: 'rows-1m', target: MiB, kind: 'rows' },
  { name: 'rows-3m', target: 3 * MiB, kind: 'rows' },
  { name: 'rows-5m', target: MAX_CSV_BYTES - 256, kind: 'rows' },
  { name: 'wide-1000', target: MiB, kind: 'wide' },
  { name: 'missing-duplicates', target: MiB, kind: 'duplicates' },
  { name: 'long-cell', target: MiB, kind: 'long' },
]

function generate({ target, kind }) {
  if (kind === 'long') {
    const header = 'id,amount,group,notes\n'
    const prefix = '1,,g,'
    const suffix = '\n2,2,g,short\n2,2,g,short\n'
    const content = header + prefix + 'x'.repeat(target - header.length - prefix.length - suffix.length) + suffix
    return Buffer.from(content)
  }
  const columns = kind === 'wide'
    ? Array.from({ length: 1000 }, (_, i) => i === 1 ? 'amount' : `c${i}`)
    : ['id', 'amount', 'group', 'notes']
  const lines = [columns.join(',')]
  let bytes = Buffer.byteLength(lines[0]) + 1
  for (let i = 0; ; i++) {
    const amount = i % 11 === 0 ? '' : String((i % 100) - 50)
    const cells = kind === 'wide'
      ? columns.map((_, index) => index === 0 ? String(i) : index === 1 ? amount : index % 3 === 0 ? 'text' : String(index))
      : [kind === 'duplicates' ? String(i % 20) : String(i % 100003), amount, `g${i % 7}`, i % 5 ? 'text' : 'longer-text']
    if (i > 0 && i % 97 === 0) {
      cells[0] = 'repeat'
      cells[1] = '5'
      if (kind !== 'wide') { cells[2] = 'g'; cells[3] = 'text' }
    }
    const line = cells.join(',')
    const lineBytes = Buffer.byteLength(line) + 1
    if (bytes + lineBytes > target) break
    lines.push(line)
    bytes += lineBytes
  }
  return Buffer.from(lines.join('\n') + '\n')
}

if (process.argv[2] === '--fixture') {
  const scenario = scenarios.find(({ name }) => name === process.argv[3])
  if (!scenario && process.argv[3] !== 'compatibility') throw new Error('Choose rows-5m, wide-1000, or compatibility.')
  const bytes = scenario ? generate(scenario) : Buffer.from('이름,메모,숫자,수식형\n가,"쉼표, 값",-123,=1+1\n나,"큰따옴표 ""인용""",-3.5,"+SUM(1,2)"\n다,"첫 줄\n둘째 줄",-1e3,@name\n')
  const path = join(tmpdir(), `dataclinic-${process.argv[3]}.csv`)
  writeFileSync(path, bytes)
  console.log(JSON.stringify({ path, bytes: bytes.length }))
  process.exit(0)
}

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
async function measure(fn) {
  await fn() // warm up
  const samples = []
  for (let i = 0; i < repetitions; i++) {
    const start = performance.now()
    await fn()
    samples.push(performance.now() - start)
  }
  return { medianMs: median(samples), minMs: Math.min(...samples), maxMs: Math.max(...samples) }
}
function heapMiB() {
  global.gc?.()
  return process.memoryUsage().heapUsed / MiB
}

const output = {
  environment: { runtime: 'Node.js', version: process.version, platform: process.platform, arch: process.arch,
    cpu: process.env.PROCESSOR_IDENTIFIER ?? 'unknown', repetitions, warmups: 1, gcAvailable: !!global.gc },
  scenarios: [],
}

for (const scenario of scenarios.filter(({ name }) => !process.argv[2] || name === process.argv[2])) {
  const bytes = generate(scenario)
  assert.ok(bytes.length <= MAX_CSV_BYTES)
  const file = new File([bytes], `${scenario.name}.csv`, { type: 'text/csv' })
  const beforeHeap = heapMiB()
  const parse = await measure(() => parseCsvFile(file, 'utf-8'))
  const original = await parseCsvFile(file, 'utf-8')
  const parsedHeap = heapMiB()
  const working = cloneCsv(original)
  const clonedHeap = heapMiB()
  const choice = { method: 'fill_mean', columnIndex: 1 }
  const diagnosis = analyzeData(working)
  const diagnosedHeap = heapMiB()
  const preview = previewCleaning(working, choice, diagnosis)
  assert.equal(preview.canApply, true)
  const previewHeap = heapMiB()
  const cleaned = preview.result
  assert.deepEqual(applyCleaning(working, choice), cleaned)
  assert.equal(original.rows[0][1], '')
  const stages = {
    parse,
    diagnose: await measure(() => analyzeData(working)),
    preview: await measure(() => previewCleaning(working, choice)),
    previewWithDiagnosis: await measure(() => previewCleaning(working, choice, diagnosis)),
    clonePreviewResult: await measure(() => cloneCsv(preview.result)),
    fill: await measure(() => applyCleaning(working, choice)),
    deduplicate: await measure(() => applyCleaning(working, { method: 'remove_duplicates', columnIndex: 0 })),
    compare: await measure(() => compareData(original, cleaned)),
    serialize: await measure(() => serializeCsv(cleaned)),
  }
  output.scenarios.push({ name: scenario.name, bytes: bytes.length, rows: original.rows.length,
    columns: original.columns.length, stages,
    heapMiB: { withFile: beforeHeap, withParsed: parsedHeap, withOriginalAndWorking: clonedHeap,
      withDiagnosis: diagnosedHeap, withPreviewResult: previewHeap } })
  console.log(JSON.stringify(output.scenarios.at(-1)))
}
console.error(JSON.stringify(output.environment))
