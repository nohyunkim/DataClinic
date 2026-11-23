import type { ParsedCsv } from './csv'
import { analyzeData, type DataDiagnosis } from './diagnosis.ts'

export interface DataComparison {
  original: DataDiagnosis
  working: DataDiagnosis
  lostRows: number
  lossRate: number
  unchanged: boolean
}

export function compareData(original: ParsedCsv, working: ParsedCsv): DataComparison {
  const originalDiagnosis = analyzeData(original)
  const workingDiagnosis = analyzeData(working)
  const lostRows = Math.max(0, originalDiagnosis.rowCount - workingDiagnosis.rowCount)
  const unchanged = original.columns.length === working.columns.length
    && original.columns.every((column, index) => column === working.columns[index])
    && original.rows.length === working.rows.length
    && original.rows.every((row, rowIndex) => row.length === working.rows[rowIndex].length
      && row.every((value, columnIndex) => value === working.rows[rowIndex][columnIndex]))

  return {
    original: originalDiagnosis,
    working: workingDiagnosis,
    lostRows,
    lossRate: originalDiagnosis.rowCount ? lostRows / originalDiagnosis.rowCount : 0,
    unchanged,
  }
}
