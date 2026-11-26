import type { ParsedCsv } from './csv'
import { previewCleaning, type CleaningChoice, type CleaningMethod } from './cleaning.ts'

export const MAX_RECIPE_BYTES = 64 * 1024
export const MAX_RECIPE_STEPS = 100

export interface RecipeStep {
  order: number
  method: CleaningMethod
  column: { name: string; index: number; matchingIndices: number[] } | null
  application: 'remove' | 'recalculate'
}

export interface CleaningRecipe {
  schemaVersion: 1
  steps: RecipeStep[]
}

export interface RecipeStepImpact {
  order: number
  status: 'applied' | 'skipped'
  removedRows: number
  changedCells: number
  reason: string | null
}

export interface RecipePreview {
  result: ParsedCsv | null
  impacts: RecipeStepImpact[]
  error: string | null
}

const methods: CleaningMethod[] = ['remove_missing', 'fill_mean', 'fill_median', 'fill_mode', 'remove_duplicates']
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const indicesFor = (columns: string[], name: string) => columns.flatMap((column, index) => column === name ? [index] : [])

export function stepFromChoice(data: ParsedCsv, choice: CleaningChoice, order: number): RecipeStep {
  const name = data.columns[choice.columnIndex]
  return {
    order,
    method: choice.method,
    column: choice.method === 'remove_duplicates' ? null : { name, index: choice.columnIndex, matchingIndices: indicesFor(data.columns, name) },
    application: choice.method.startsWith('fill_') ? 'recalculate' : 'remove',
  }
}

export function serializeRecipe(steps: RecipeStep[]): string {
  return JSON.stringify({ schemaVersion: 1, steps } satisfies CleaningRecipe, null, 2)
}

export function parseRecipe(source: string): CleaningRecipe {
  if (new TextEncoder().encode(source).byteLength > MAX_RECIPE_BYTES) throw new Error('레시피 파일은 64KB 이하여야 합니다.')
  let value: unknown
  try { value = JSON.parse(source) } catch { throw new Error('올바른 JSON 파일이 아닙니다.') }
  if (!object(value) || value.schemaVersion !== 1 || !Array.isArray(value.steps)) throw new Error('지원하지 않는 레시피 스키마입니다. 버전 1과 steps 배열을 확인해 주세요.')
  if (value.steps.length === 0 || value.steps.length > MAX_RECIPE_STEPS) throw new Error(`레시피 작업은 1~${MAX_RECIPE_STEPS}개여야 합니다.`)
  const steps: RecipeStep[] = value.steps.map((raw: unknown, index: number) => {
    if (!object(raw) || raw.order !== index + 1 || !methods.includes(raw.method as CleaningMethod)) throw new Error(`${index + 1}단계의 순서 또는 정제 작업이 올바르지 않습니다.`)
    const method = raw.method as CleaningMethod
    const expectedApplication = method.startsWith('fill_') ? 'recalculate' : 'remove'
    if (raw.application !== expectedApplication) throw new Error(`${index + 1}단계의 적용 방식이 올바르지 않습니다.`)
    if (method === 'remove_duplicates') {
      if (raw.column !== null) throw new Error(`${index + 1}단계는 대상 컬럼이 없어야 합니다.`)
      return { order: index + 1, method, column: null, application: expectedApplication }
    }
    const column = raw.column
    if (!object(column) || typeof column.name !== 'string' || !column.name.trim() || !Number.isSafeInteger(column.index) || (column.index as number) < 0 || !Array.isArray(column.matchingIndices) || !column.matchingIndices.length || !column.matchingIndices.every((item: unknown, i: number, list: unknown[]) => typeof item === 'number' && Number.isSafeInteger(item) && item >= 0 && (i === 0 || item > (list[i - 1] as number))) || !column.matchingIndices.includes(column.index)) {
      throw new Error(`${index + 1}단계의 대상 컬럼 이름·위치 정보가 올바르지 않습니다.`)
    }
    return { order: index + 1, method, column: { name: column.name, index: column.index as number, matchingIndices: column.matchingIndices as number[] }, application: expectedApplication }
  })
  return { schemaVersion: 1, steps }
}

export function previewRecipe(data: ParsedCsv, recipe: CleaningRecipe): RecipePreview {
  let current = data
  const impacts: RecipeStepImpact[] = []
  for (const step of recipe.steps) {
    if (step.column) {
      const { name, index, matchingIndices } = step.column
      const actual = indicesFor(current.columns, name)
      if (current.columns[index] !== name || actual.length !== matchingIndices.length || actual.some((position, i) => position !== matchingIndices[i])) {
        return { result: null, impacts, error: `${step.order}단계: '${name}' 컬럼의 이름 또는 위치가 대상 CSV와 일치하지 않습니다.` }
      }
    }
    const preview = previewCleaning(current, { method: step.method, columnIndex: step.column?.index ?? 0 })
    if (!preview.canApply || !preview.result) {
      const noTarget = current.rows.length > 0 && (step.method === 'remove_duplicates'
        ? preview.before.duplicateRows.length === 0
        : preview.before.columns[step.column!.index].missingCount === 0)
      if (!noTarget) return { result: null, impacts, error: `${step.order}단계: ${preview.reason ?? '정제를 적용할 수 없습니다.'}` }
      impacts.push({ order: step.order, status: 'skipped', removedRows: 0, changedCells: 0, reason: preview.reason })
      continue
    }
    impacts.push({ order: step.order, status: 'applied', removedRows: preview.removedRows, changedCells: preview.changedCells, reason: null })
    current = preview.result
  }
  return { result: current, impacts, error: null }
}
