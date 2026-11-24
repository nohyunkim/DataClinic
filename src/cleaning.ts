import type { ParsedCsv } from './csv'
import { analyzeData, isMissing, type DataDiagnosis } from './diagnosis.ts'

export type CleaningMethod = 'remove_missing' | 'fill_mean' | 'fill_median' | 'fill_mode' | 'remove_duplicates'

export interface CleaningChoice {
  method: CleaningMethod
  columnIndex: number
}

export interface CleaningExample {
  rowNumber: number
  before: string
  after: string
}

export interface CleaningPreview {
  choice: CleaningChoice
  canApply: boolean
  reason: string | null
  before: DataDiagnosis
  after: DataDiagnosis | null
  result: ParsedCsv | null
  removedRows: number
  changedCells: number
  dataLossRate: number
  replacementValue: string | null
  affectedRowIndices: number[]
  examples: CleaningExample[]
}

export function cloneCsv(data: ParsedCsv): ParsedCsv {
  return { ...data, columns: [...data.columns], rows: data.rows.map((row) => [...row]) }
}

function blocked(choice: CleaningChoice, before: DataDiagnosis, reason: string): CleaningPreview {
  return { choice, canApply: false, reason, before, after: null, result: null, removedRows: 0, changedCells: 0, dataLossRate: 0, replacementValue: null, affectedRowIndices: [], examples: [] }
}

function modeValue(data: ParsedCsv, columnIndex: number): string | null {
  const counts = new Map<string, number>()
  for (const row of data.rows) {
    const value = row[columnIndex] ?? ''
    if (isMissing(value)) continue
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  let selected: string | null = null
  let highest = 0
  for (const [value, count] of counts) {
    if (count <= highest) continue
    highest = count
    selected = value
  }
  return selected
}

export function previewCleaning(data: ParsedCsv, choice: CleaningChoice, before = analyzeData(data)): CleaningPreview {
  const column = before.columns[choice.columnIndex]
  if (choice.method !== 'remove_duplicates' && !column) return blocked(choice, before, '대상 컬럼을 선택해 주세요.')
  if (before.rowCount === 0) return blocked(choice, before, '데이터 행이 없어 정제를 적용할 수 없습니다.')

  const result = cloneCsv(data)
  let removedRows = 0
  let changedCells = 0
  let replacementValue: string | null = null
  let affectedRowIndices: number[] = []
  let examples: CleaningExample[] = []

  if (choice.method === 'remove_missing') {
    affectedRowIndices = column.missingRowIndices
    removedRows = affectedRowIndices.length
    if (removedRows === 0) return blocked(choice, before, '선택한 컬럼에 결측 셀이 없습니다.')
    if (removedRows === before.rowCount) return blocked(choice, before, '모든 데이터 행이 삭제되므로 적용할 수 없습니다.')
    const removed = new Set(affectedRowIndices)
    result.rows = result.rows.filter((_, index) => !removed.has(index))
    examples = affectedRowIndices.slice(0, 5).map((index) => ({ rowNumber: index + 1, before: data.rows[index].join(' | '), after: '행 삭제' }))
  } else if (choice.method === 'remove_duplicates') {
    affectedRowIndices = before.duplicateRows.map(({ rowIndex }) => rowIndex)
    removedRows = affectedRowIndices.length
    if (removedRows === 0) return blocked(choice, before, '완전 중복 행이 없습니다.')
    const removed = new Set(affectedRowIndices)
    result.rows = result.rows.filter((_, index) => !removed.has(index))
    examples = affectedRowIndices.slice(0, 5).map((index) => ({ rowNumber: index + 1, before: data.rows[index].join(' | '), after: '행 삭제' }))
  } else {
    affectedRowIndices = column.missingRowIndices
    changedCells = affectedRowIndices.length
    if (changedCells === 0) return blocked(choice, before, '선택한 컬럼에 대체할 결측 셀이 없습니다.')
    if (choice.method === 'fill_mean' || choice.method === 'fill_median') {
      if (column.type === 'empty') return blocked(choice, before, '유효한 숫자가 없어 대체값을 계산할 수 없습니다.')
      if (column.type !== 'number') return blocked(choice, before, '평균값과 중앙값은 숫자형 컬럼에서만 사용할 수 있습니다.')
      const numeric = choice.method === 'fill_mean' ? column.stats?.mean : column.stats?.median
      if (numeric === undefined || !Number.isFinite(numeric)) return blocked(choice, before, '유효한 숫자가 없어 대체값을 계산할 수 없습니다.')
      replacementValue = String(numeric)
    } else if (choice.method === 'fill_mode') {
      if (column.type === 'empty') return blocked(choice, before, '유효한 값이 없어 최빈값을 계산할 수 없습니다.')
      if (column.type !== 'number' && column.type !== 'string') return blocked(choice, before, '최빈값은 숫자형 또는 문자열형 컬럼에서만 사용할 수 있습니다.')
      replacementValue = modeValue(data, choice.columnIndex)
      if (replacementValue === null) return blocked(choice, before, '유효한 값이 없어 최빈값을 계산할 수 없습니다.')
    } else {
      return blocked(choice, before, '지원하지 않는 정제 방법입니다.')
    }
    if (replacementValue === null) return blocked(choice, before, '대체값을 계산할 수 없습니다.')
    const fillValue = replacementValue
    for (const index of affectedRowIndices) result.rows[index][choice.columnIndex] = replacementValue
    examples = affectedRowIndices.slice(0, 5).map((index) => ({ rowNumber: index + 1, before: data.rows[index][choice.columnIndex], after: fillValue }))
  }

  return {
    choice,
    canApply: true,
    reason: null,
    before,
    after: analyzeData(result),
    result,
    removedRows,
    changedCells,
    dataLossRate: before.rowCount ? removedRows / before.rowCount : 0,
    replacementValue,
    affectedRowIndices,
    examples,
  }
}

export function applyCleaning(data: ParsedCsv, choice: CleaningChoice): ParsedCsv {
  const preview = previewCleaning(data, choice)
  if (!preview.canApply || !preview.result) throw new Error(preview.reason ?? '정제를 적용할 수 없습니다.')
  return preview.result
}
