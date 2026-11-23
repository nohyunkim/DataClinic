import Papa from 'papaparse'

export const MAX_CSV_BYTES = 5 * 1024 * 1024
export type CsvEncoding = 'utf-8' | 'euc-kr'

export interface ParsedCsv {
  fileName: string
  fileSize: number
  encoding: CsvEncoding
  columns: string[]
  rows: string[][]
}

export class CsvValidationError extends Error {}

export async function parseCsvFile(file: File, encoding: CsvEncoding): Promise<ParsedCsv> {
  if (!/\.csv$/i.test(file.name)) {
    throw new CsvValidationError('CSV 파일(.csv)을 선택해 주세요.')
  }
  if (file.size > MAX_CSV_BYTES) {
    throw new CsvValidationError('파일 크기는 5MB 이하여야 합니다.')
  }
  if (file.size === 0) {
    throw new CsvValidationError('빈 파일은 업로드할 수 없습니다.')
  }

  let source: string
  try {
    source = new TextDecoder(encoding, { fatal: true }).decode(await file.arrayBuffer())
  } catch {
    throw new CsvValidationError('파일을 읽을 수 없습니다. UTF-8 또는 CP949 인코딩을 선택해 다시 시도해 주세요.')
  }
  if (!source.trim()) {
    throw new CsvValidationError('빈 파일은 업로드할 수 없습니다.')
  }

  const result = Papa.parse<string[]>(source, {
    delimiter: ',',
    skipEmptyLines: false,
  })
  const parseError = result.errors[0]
  if (parseError) {
    const rowHint = parseError.row === undefined ? '' : `${parseError.row + 1}행의 `
    throw new CsvValidationError(`CSV 파싱 오류가 있습니다. ${rowHint}따옴표와 구분자를 확인해 주세요.`)
  }

  const records = result.data
  // A final line break is not an additional data row.
  if (/(?:\r\n|\r|\n)$/.test(source) && records.at(-1)?.length === 1 && records.at(-1)?.[0] === '') {
    records.pop()
  }
  const columns = records.shift()
  if (!columns?.length || columns.every((column) => column.trim() === '')) {
    throw new CsvValidationError('CSV에 컬럼명이 없습니다. 첫 행을 확인해 주세요.')
  }
  if (columns.some((column) => column.trim() === '')) {
    throw new CsvValidationError('비어 있는 컬럼명이 있습니다. 첫 행을 확인해 주세요.')
  }
  if (records.length === 0) {
    throw new CsvValidationError('데이터 행이 없습니다. 컬럼명 다음에 데이터를 추가해 주세요.')
  }
  if (records.some((row) => row.length !== columns.length)) {
    throw new CsvValidationError('행마다 컬럼 수가 다릅니다. CSV의 쉼표와 따옴표를 확인해 주세요.')
  }

  return { fileName: file.name, fileSize: file.size, encoding, columns, rows: records }
}
