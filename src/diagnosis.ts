import type { ParsedCsv } from './csv'

export type InferredType = 'number' | 'string' | 'mixed' | 'empty'

export interface NumericStats {
  validCount: number
  min: number
  max: number
  mean: number
  median: number
}

export interface ColumnDiagnosis {
  index: number
  name: string
  type: InferredType
  uniqueCount: number
  missingCount: number
  missingRate: number
  missingRowIndices: number[]
  stats: NumericStats | null
}

export interface DuplicateRow {
  rowIndex: number
  originalRowIndex: number
}

export interface DataDiagnosis {
  rowCount: number
  columnCount: number
  missingCellCount: number
  missingRowIndices: number[]
  duplicateRows: DuplicateRow[]
  columns: ColumnDiagnosis[]
}

export function isMissing(value: string): boolean {
  return value.trim() === ''
}

// Restrict numeric inference to ordinary decimal notation. This also keeps
// identifiers with leading zeros as strings instead of treating them as numbers.
function parseConservativeNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!/^[+-]?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(trimmed)) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function numericStats(values: number[]): NumericStats | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  let mean = 0
  values.forEach((value, index) => { mean += (value - mean) / (index + 1) })
  const middle = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 === 1
    ? sorted[middle]
    : sorted[middle - 1] / 2 + sorted[middle] / 2
  if (!Number.isFinite(mean) || !Number.isFinite(median)) return null
  return { validCount: values.length, min: sorted[0], max: sorted[sorted.length - 1], mean, median }
}

export function analyzeData(data: ParsedCsv): DataDiagnosis {
  const rowCount = data.rows.length
  const columnCount = data.columns.length
  const missingRows = new Set<number>()
  const columns = data.columns.map((name, index): ColumnDiagnosis => {
    const missingRowIndices: number[] = []
    const unique = new Set<string>()
    const numericValues: number[] = []
    let numberCount = 0
    let stringCount = 0

    data.rows.forEach((row, rowIndex) => {
      const value = row[index] ?? ''
      if (isMissing(value)) {
        missingRowIndices.push(rowIndex)
        missingRows.add(rowIndex)
        return
      }
      unique.add(value)
      const numeric = parseConservativeNumber(value)
      if (numeric === null) stringCount++
      else {
        numberCount++
        numericValues.push(numeric)
      }
    })

    const type: InferredType = numberCount && stringCount ? 'mixed'
      : numberCount ? 'number'
      : stringCount ? 'string'
      : 'empty'
    return {
      index,
      name,
      type,
      uniqueCount: unique.size,
      missingCount: missingRowIndices.length,
      missingRate: rowCount ? missingRowIndices.length / rowCount : 0,
      missingRowIndices,
      stats: type === 'number' ? numericStats(numericValues) : null,
    }
  })

  const firstOccurrence = new Map<string, number>()
  const duplicateRows: DuplicateRow[] = []
  data.rows.forEach((row, rowIndex) => {
    const key = JSON.stringify(row)
    const originalRowIndex = firstOccurrence.get(key)
    if (originalRowIndex === undefined) firstOccurrence.set(key, rowIndex)
    else duplicateRows.push({ rowIndex, originalRowIndex })
  })

  return {
    rowCount,
    columnCount,
    missingCellCount: columns.reduce((total, column) => total + column.missingCount, 0),
    missingRowIndices: [...missingRows].sort((a, b) => a - b),
    duplicateRows,
    columns,
  }
}
