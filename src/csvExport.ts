import Papa from 'papaparse'
import type { ParsedCsv } from './csv'

export type DownloadEncoding = 'utf-8' | 'utf-8-bom'

// Papa Parse prepends an apostrophe to values matching this expression.
// Leading whitespace, tabs, and line breaks can hide a spreadsheet formula.
export const FORMULA_PREFIX = /^(?:[\t\r\n]|[\s\uFEFF\u200B]*[=+\-@])/u

export function formulaRiskCount(data: ParsedCsv): number {
  let count = 0
  for (const value of data.columns) if (FORMULA_PREFIX.test(value)) count++
  for (const row of data.rows) for (const value of row) if (FORMULA_PREFIX.test(value)) count++
  return count
}

export function serializeCsv(data: ParsedCsv): string {
  return Papa.unparse({ fields: data.columns, data: data.rows }, {
    delimiter: ',',
    newline: '\r\n',
    escapeFormulae: FORMULA_PREFIX,
  })
}

export function createCsvBlob(data: ParsedCsv, encoding: DownloadEncoding): Blob {
  return new Blob([encoding === 'utf-8-bom' ? '\uFEFF' : '', serializeCsv(data)], { type: 'text/csv;charset=utf-8' })
}

export function cleanedFileName(fileName: string): string {
  const base = fileName.replace(/\.csv$/i, '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') || 'data'
  return `${base}_cleaned.csv`
}

export function downloadCsv(data: ParsedCsv, encoding: DownloadEncoding): string {
  const url = URL.createObjectURL(createCsvBlob(data, encoding))
  const anchor = document.createElement('a')
  const name = cleanedFileName(data.fileName)
  anchor.href = url
  anchor.download = name
  anchor.style.display = 'none'
  document.body.append(anchor)
  try {
    anchor.click()
  } finally {
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return name
}
