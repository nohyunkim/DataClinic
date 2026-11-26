import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, CircleAlert, FileSpreadsheet, RotateCcw, Table2, WandSparkles } from 'lucide-react'
import type { ParsedCsv } from './csv'
import { previewCleaning, type CleaningMethod } from './cleaning'
import { analyzeData, isMissing } from './diagnosis'
import { columnLabels } from './columnLabel'
import './workspace.css'
import './cleaning.css'

interface CleaningWorkspaceProps {
  original: ParsedCsv
  working: ParsedCsv
  cleaningCount: number
  onApply: (data: ParsedCsv) => void
  onReset: () => void
  onDiagnosis: () => void
  onComparison: () => void
  onUpload: () => void
  onHome: () => void
}

const PAGE_SIZE = 20
const methodLabels: Record<CleaningMethod, string> = {
  remove_missing: '결측 행 삭제',
  fill_mean: '평균값 대체',
  fill_median: '중앙값 대체',
  fill_mode: '최빈값 대체',
  remove_duplicates: '완전 중복 행 제거',
}
const methodDescriptions: Record<CleaningMethod, string> = {
  remove_missing: '선택한 컬럼이 비어 있는 행만 제거합니다.',
  fill_mean: '선택한 숫자형 컬럼의 유효값 평균으로 빈 셀을 채웁니다.',
  fill_median: '선택한 숫자형 컬럼의 유효값 중앙값으로 빈 셀을 채웁니다.',
  fill_mode: '가장 자주 등장한 원본 값으로 빈 셀을 채웁니다. 동률이면 먼저 등장한 값을 사용합니다.',
  remove_duplicates: '모든 컬럼의 원본 값이 같은 행 중 첫 행만 남깁니다. 공백과 대소문자는 그대로 비교합니다.',
}

export default function CleaningWorkspace({ original, working, cleaningCount, onApply, onReset, onDiagnosis, onComparison, onUpload, onHome }: CleaningWorkspaceProps) {
  const diagnosis = useMemo(() => analyzeData(working), [working])
  const labels = useMemo(() => columnLabels(working.columns), [working.columns])
  const [columnIndex, setColumnIndex] = useState(() => diagnosis.columns.find((column) => column.missingCount > 0)?.index ?? 0)
  const [method, setMethod] = useState<CleaningMethod>('remove_missing')
  const [page, setPage] = useState(0)
  const [notice, setNotice] = useState('')
  const choice = useMemo(() => ({ method, columnIndex }), [method, columnIndex])
  const preview = useMemo(() => previewCleaning(working, choice, diagnosis), [working, choice, diagnosis])
  const affected = useMemo(() => new Set(preview.affectedRowIndices), [preview])
  const duplicates = useMemo(() => new Set(diagnosis.duplicateRows.map(({ rowIndex }) => rowIndex)), [diagnosis])
  const column = diagnosis.columns[columnIndex]
  const pageCount = Math.max(1, Math.ceil(working.rows.length / PAGE_SIZE))
  const start = page * PAGE_SIZE
  const rows = working.rows.slice(start, start + PAGE_SIZE)
  const isRemoval = method === 'remove_missing' || method === 'remove_duplicates'
  const noTarget = !preview.canApply && diagnosis.rowCount > 0 && (
    method === 'remove_duplicates'
      ? diagnosis.duplicateRows.length === 0
      : column?.missingCount === 0
  )
  const expectedRowLabel = preview.after
    ? `현재 ${preview.before.rowCount.toLocaleString()}행 → ${preview.after.rowCount.toLocaleString()}행`
    : noTarget
      ? `적용 대상 없음 · 현재 ${preview.before.rowCount.toLocaleString()}행 유지`
      : `현재 ${preview.before.rowCount.toLocaleString()}행 → 계산 불가`
  const cellChangeRate = working.rows.length * working.columns.length
    ? preview.changedCells / (working.rows.length * working.columns.length)
    : 0

  useEffect(() => { setPage(Math.floor((preview.affectedRowIndices[0] ?? 0) / PAGE_SIZE)) }, [preview])

  const apply = () => {
    if (!preview.canApply || !preview.result) return
    onApply(preview.result)
    setNotice(`${methodLabels[method]} 작업을 적용했습니다. 작업 데이터의 진단 결과가 갱신되었습니다.`)
  }

  const reset = () => {
    if (!window.confirm('적용한 정제를 모두 취소하고 업로드 직후 원본으로 초기화할까요?')) return
    onReset()
    setNotice('작업 데이터를 업로드 직후 원본으로 초기화했습니다.')
  }

  return <div className="workspace-shell">
    <header className="workspace-header"><button className="workspace-brand" type="button" onClick={onHome} aria-label="DataClinic 홈"><span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span><span>Data<span>Clinic</span></span></button><div className="workspace-dataset"><FileSpreadsheet size={17} /><strong title={working.fileName}>{working.fileName}</strong></div><div className="workspace-flow" aria-label="작업 단계"><span className="done">업로드</span><ArrowRight size={13} /><span className="done">진단</span><ArrowRight size={13} /><span className="active">정제</span><ArrowRight size={13} /><span>비교</span><ArrowRight size={13} /><span>다운로드</span></div></header>
    <div className="workspace-layout">
      <aside className="workspace-nav" aria-label="워크스페이스 메뉴"><p>WORKSPACE</p><button type="button" onClick={onDiagnosis}><CircleAlert size={16} /> 데이터 진단</button><a href="#cleaning-table"><Table2 size={16} /> 작업 데이터</a><a href="#impact-preview"><WandSparkles size={16} /> 영향 미리보기</a><button type="button" onClick={onComparison}><ArrowRight size={16} /> 정제 전후 비교</button><button type="button" onClick={onUpload}><ArrowLeft size={16} /> 업로드 화면</button><small>정제는 작업 데이터에만 적용됩니다. 원본은 별도로 보관됩니다.</small></aside>
      <main className="workspace-main"><div className="workspace-title"><span className="section-kicker">03 / DATA CLEANING</span><h1>데이터 정제</h1><p>방법을 선택하고 예상 변화를 확인한 뒤 적용하세요.</p></div>
        {notice && <div className="cleaning-notice" role="status">{notice}</div>}
        <section className="workspace-card" aria-label="작업 데이터 요약"><div className="workspace-section-head"><div><span className="section-kicker">WORKING DATA</span><h2>현재 작업 데이터</h2></div><span className="workspace-subtle">정제 적용 {cleaningCount}회 · 원본 {original.rows.length.toLocaleString()}행 보존</span></div><div className="workspace-summary"><div><span>현재 행</span><strong>{diagnosis.rowCount.toLocaleString()}</strong></div><div><span>컬럼</span><strong>{diagnosis.columnCount.toLocaleString()}</strong></div><div><span>결측 셀</span><strong>{diagnosis.missingCellCount.toLocaleString()}</strong></div><div><span>중복 행</span><strong>{diagnosis.duplicateRows.length.toLocaleString()}</strong></div></div></section>
        <section id="cleaning-table" className="workspace-card" aria-labelledby="cleaning-table-title"><div className="workspace-section-head"><div><span className="section-kicker">DATA TABLE</span><h2 id="cleaning-table-title">작업 데이터 미리보기</h2></div><span className="workspace-subtle">{working.rows.length ? `${start + 1}–${Math.min(start + PAGE_SIZE, working.rows.length)} / ${working.rows.length.toLocaleString()}행` : '0행'}</span></div><div className="diagnosis-table-scroll" role="region" aria-label="정제 작업 데이터 표" tabIndex={0}><table><thead><tr><th scope="col" className="row-number">행</th>{working.columns.map((_, index) => <th scope="col" key={index} className={columnIndex === index && method !== 'remove_duplicates' ? 'selected-column' : ''}><button type="button" onClick={() => { setColumnIndex(index); setNotice('') }}>{labels[index]}</button></th>)}</tr></thead><tbody>{rows.map((row, offset) => { const rowIndex = start + offset; const willRemove = preview.canApply && isRemoval && affected.has(rowIndex); const willFill = preview.canApply && !isRemoval && affected.has(rowIndex); return <tr key={rowIndex} className={`${duplicates.has(rowIndex) ? 'duplicate-row ' : ''}${willRemove ? 'preview-remove-row' : ''}`}><th scope="row" className="row-number"><span>{rowIndex + 1}</span>{willRemove && <small>삭제 예정</small>}{!willRemove && duplicates.has(rowIndex) && <small>중복</small>}</th>{row.map((value, cellIndex) => <td key={cellIndex} className={`${isMissing(value) ? 'missing-cell ' : ''}${columnIndex === cellIndex && method !== 'remove_duplicates' ? 'selected-column ' : ''}${willFill && columnIndex === cellIndex ? 'preview-fill-cell' : ''}`}>{isMissing(value) ? <span>빈 값</span> : value}{willFill && columnIndex === cellIndex && <small className="preview-replacement">→ {preview.replacementValue}</small>}</td>)}</tr> })}</tbody></table></div>{working.rows.length === 0 && <p className="empty-table">데이터 행이 없습니다.</p>}<div className="table-footer"><span><i className="legend-missing" /> 결측 셀 <i className="legend-duplicate" /> 중복 행</span><div><button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>이전</button><span>{page + 1} / {pageCount}</span><button type="button" disabled={page >= pageCount - 1} onClick={() => setPage(page + 1)}>다음</button></div></div></section>
        <section id="impact-preview" className="workspace-card" aria-labelledby="impact-title"><div className="workspace-section-head"><div><span className="section-kicker">IMPACT PREVIEW</span><h2 id="impact-title">적용 전 영향 미리보기</h2></div><span className="workspace-subtle">예상 결과는 현재 작업 데이터에 아직 적용되지 않았습니다</span></div><p className="impact-method">{methodLabels[method]} · {method === 'remove_duplicates' ? '전체 컬럼' : column ? labels[columnIndex] : '컬럼 미선택'}</p><div className="impact-stats"><div><span>현재 → 예상 행</span><strong>{preview.before.rowCount.toLocaleString()} → {preview.after?.rowCount.toLocaleString() ?? '—'}</strong></div><div><span>삭제 행 / 변경 셀</span><strong>{preview.removedRows.toLocaleString()}행 / {preview.changedCells.toLocaleString()}셀</strong></div><div><span>행 손실 비율</span><strong>{(preview.dataLossRate * 100).toFixed(1)}%</strong></div><div><span>셀 변경 비율</span><strong>{(cellChangeRate * 100).toFixed(1)}%</strong></div><div><span>결측 셀 전 → 후</span><strong>{preview.before.missingCellCount.toLocaleString()} → {preview.after?.missingCellCount.toLocaleString() ?? '—'}</strong></div><div><span>중복 행 전 → 후</span><strong>{preview.before.duplicateRows.length.toLocaleString()} → {preview.after?.duplicateRows.length.toLocaleString() ?? '—'}</strong></div></div>{preview.replacementValue !== null && <p className="impact-replacement">대체할 값: <strong>{preview.replacementValue}</strong></p>}{preview.examples.length > 0 && <div className="impact-examples"><h3>변경 예시 <small>최대 5개</small></h3>{preview.examples.map((example) => <div key={example.rowNumber}><span>{example.rowNumber}행</span><span title={example.before}>{example.before || '빈 값'}</span><ArrowRight size={13} /><strong title={example.after}>{example.after}</strong></div>)}</div>}{!preview.canApply && <p className="impact-blocked"><CircleAlert size={16} /> {preview.reason}</p>}</section>
      </main>
      <aside className="workspace-detail" aria-label="정제 작업 패널"><div className="detail-sticky cleaning-panel"><span className="section-kicker">CLEANING ACTION</span><h2>정제 방법 선택</h2><label>대상 컬럼<select value={columnIndex} disabled={method === 'remove_duplicates'} onChange={(event) => { setColumnIndex(Number(event.target.value)); setNotice('') }}>{working.columns.map((_, index) => <option key={index} value={index}>{labels[index]}</option>)}</select></label>{method === 'remove_duplicates' && <p className="panel-hint">완전 중복은 전체 컬럼을 비교합니다.</p>}<label>정제 방법<select value={method} onChange={(event) => { setMethod(event.target.value as CleaningMethod); setNotice('') }}><option value="remove_missing">결측 행 삭제</option><option value="fill_mean" disabled={column?.type !== 'number'}>평균값 대체</option><option value="fill_median" disabled={column?.type !== 'number'}>중앙값 대체</option><option value="fill_mode" disabled={column?.type !== 'number' && column?.type !== 'string'}>최빈값 대체</option><option value="remove_duplicates">완전 중복 행 제거</option></select></label><p className="detail-explanation">{methodDescriptions[method]}</p><div className="panel-impact"><strong>예상 영향</strong><span>{expectedRowLabel}</span><span>{isRemoval ? `삭제 예정 ${preview.removedRows.toLocaleString()}행` : `변경 예정 ${preview.changedCells.toLocaleString()}셀`}</span><span>행 손실 {(preview.dataLossRate * 100).toFixed(1)}%</span></div>{!preview.canApply && <p className="panel-error" role="status">{preview.reason}</p>}<button className="apply-cleaning" type="button" disabled={!preview.canApply} onClick={apply}>정제 적용하기</button><button className="reset-cleaning" type="button" disabled={cleaningCount === 0} onClick={reset}><RotateCcw size={15} /> 원본으로 초기화</button><p className="panel-hint">적용 버튼을 누르기 전에는 작업 데이터도 변경되지 않습니다.</p></div></aside>
    </div>
  </div>
}
