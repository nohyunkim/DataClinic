import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, CircleAlert, Download, FileSpreadsheet, GitCompareArrows, Table2 } from 'lucide-react'
import type { ParsedCsv } from './csv'
import { compareData } from './comparison'
import { isMissing, type NumericStats } from './diagnosis'
import { cleanedFileName, downloadCsv, formulaRiskCount, type DownloadEncoding } from './csvExport'
import './workspace.css'
import './comparison.css'

interface ComparisonWorkspaceProps {
  original: ParsedCsv
  working: ParsedCsv
  onCleaning: () => void
  onDiagnosis: () => void
  onUpload: () => void
  onHome: () => void
}

const PAGE_SIZE = 20
const display = (value: number | undefined) => value === undefined || !Number.isFinite(value)
  ? 'N/A'
  : value.toLocaleString('ko-KR', { maximumFractionDigits: 4 })
const statFields: { key: keyof Omit<NumericStats, 'validCount'>; label: string }[] = [
  { key: 'mean', label: '평균' }, { key: 'median', label: '중앙값' },
  { key: 'min', label: '최솟값' }, { key: 'max', label: '최댓값' },
]

export default function ComparisonWorkspace({ original, working, onCleaning, onDiagnosis, onUpload, onHome }: ComparisonWorkspaceProps) {
  const comparison = useMemo(() => compareData(original, working), [original, working])
  const [tab, setTab] = useState<'original' | 'working'>('working')
  const [page, setPage] = useState(0)
  const [encoding, setEncoding] = useState<DownloadEncoding>('utf-8')
  const [message, setMessage] = useState('')
  const selected = tab === 'original' ? original : working
  const diagnosis = tab === 'original' ? comparison.original : comparison.working
  const duplicates = useMemo(() => new Set(diagnosis.duplicateRows.map(({ rowIndex }) => rowIndex)), [diagnosis])
  const riskCount = useMemo(() => formulaRiskCount(working), [working])
  const pageCount = Math.max(1, Math.ceil(selected.rows.length / PAGE_SIZE))
  const start = page * PAGE_SIZE
  const numericColumns = original.columns.map((name, index) => ({ name, index, before: comparison.original.columns[index]?.stats, after: comparison.working.columns[index]?.stats }))
    .filter(({ before, after }) => before || after)

  useEffect(() => setPage(0), [tab, original, working])

  const download = () => {
    try {
      const name = downloadCsv(working, encoding)
      setMessage(`${name} 다운로드를 시작했습니다.`)
    } catch {
      setMessage('CSV 파일을 만들지 못했습니다. 다시 시도해 주세요.')
    }
  }

  return <div className="workspace-shell">
    <header className="workspace-header"><button className="workspace-brand" type="button" onClick={onHome} aria-label="DataClinic 홈"><span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span><span>Data<span>Clinic</span></span></button><div className="workspace-dataset"><FileSpreadsheet size={17} /><strong title={original.fileName}>{original.fileName}</strong></div><div className="workspace-flow" aria-label="작업 단계"><span className="done">업로드</span><ArrowRight size={13} /><span className="done">진단</span><ArrowRight size={13} /><span className="done">정제</span><ArrowRight size={13} /><span className="active">비교</span><ArrowRight size={13} /><span>다운로드</span></div></header>
    <div className="workspace-layout">
      <aside className="workspace-nav" aria-label="워크스페이스 메뉴"><p>WORKSPACE</p><button type="button" onClick={onDiagnosis}><CircleAlert size={16} /> 데이터 진단</button><button type="button" onClick={onCleaning}><ArrowLeft size={16} /> 데이터 정제</button><a href="#comparison-summary"><GitCompareArrows size={16} /> 변화 요약</a><a href="#comparison-table"><Table2 size={16} /> 데이터 확인</a><button type="button" onClick={onUpload}><ArrowLeft size={16} /> 업로드 화면</button><small>최초 업로드 원본과 현재 작업 데이터를 비교합니다.</small></aside>
      <main className="workspace-main"><div className="workspace-title"><span className="section-kicker">04 / DATA COMPARISON</span><h1>정제 전후 비교</h1><p>최초 업로드 원본과 현재 작업 데이터의 차이를 확인하세요.</p></div>
        {comparison.unchanged && <div className="comparison-unchanged">아직 적용한 데이터 변화가 없습니다. 원본과 작업 데이터가 동일합니다.</div>}
        <section id="comparison-summary" className="workspace-card" aria-labelledby="comparison-title"><div className="workspace-section-head"><div><span className="section-kicker">BEFORE / AFTER</span><h2 id="comparison-title">주요 진단 수치</h2></div><span className="workspace-subtle">원본 → 현재 작업 데이터</span></div><div className="comparison-metrics">{[
          ['전체 행', comparison.original.rowCount, comparison.working.rowCount, '행'],
          ['전체 컬럼', comparison.original.columnCount, comparison.working.columnCount, '개'],
          ['결측 셀', comparison.original.missingCellCount, comparison.working.missingCellCount, '개'],
          ['결측 포함 행', comparison.original.missingRowIndices.length, comparison.working.missingRowIndices.length, '행'],
          ['완전 중복 행', comparison.original.duplicateRows.length, comparison.working.duplicateRows.length, '행'],
        ].map(([label, before, after, unit]) => <div key={label}><span>{label}</span><strong>{Number(before).toLocaleString()}{unit} <ArrowRight size={13} /> {Number(after).toLocaleString()}{unit}</strong></div>)}</div><p className="workspace-help">수치 변화는 데이터의 변화를 보여줍니다. 결측치 감소만으로 데이터 품질 전체의 향상을 판단하지 않습니다.</p></section>
        <section className="workspace-card" aria-labelledby="column-comparison-title"><div className="workspace-section-head"><div><span className="section-kicker">COLUMN DETAILS</span><h2 id="column-comparison-title">컬럼별 결측 비교</h2></div></div><div className="comparison-table-scroll"><table><thead><tr><th scope="col">컬럼</th><th scope="col">원본</th><th scope="col">작업 데이터</th></tr></thead><tbody>{original.columns.map((name, index) => { const before = comparison.original.columns[index]; const after = comparison.working.columns[index]; return <tr key={index}><th scope="row">{name}</th><td>{before ? `${before.missingCount.toLocaleString()}개 (${(before.missingRate * 100).toFixed(1)}%)` : 'N/A'}</td><td>{after ? `${after.missingCount.toLocaleString()}개 (${(after.missingRate * 100).toFixed(1)}%)` : 'N/A'}</td></tr> })}</tbody></table></div></section>
        <section className="workspace-card" aria-labelledby="numeric-comparison-title"><div className="workspace-section-head"><div><span className="section-kicker">NUMERIC STATISTICS</span><h2 id="numeric-comparison-title">숫자형 통계 비교</h2></div></div>{numericColumns.length === 0 ? <p className="comparison-empty">비교할 숫자형 컬럼이 없습니다.</p> : <div className="comparison-table-scroll"><table><thead><tr><th scope="col">컬럼</th><th scope="col">통계량</th><th scope="col">원본</th><th scope="col">작업 데이터</th></tr></thead><tbody>{numericColumns.flatMap(({ name, index, before, after }) => statFields.map(({ key, label }) => <tr key={`${index}-${key}`}><th scope="row">{name}</th><td>{label}</td><td>{display(before?.[key])}</td><td>{display(after?.[key])}</td></tr>))}</tbody></table></div>}<p className="workspace-help">각 데이터에서 숫자형으로 추론된 컬럼만 계산합니다. 계산할 수 없는 값은 N/A로 표시합니다.</p></section>
        <section id="comparison-table" className="workspace-card" aria-labelledby="preview-comparison-title"><div className="workspace-section-head"><div><span className="section-kicker">DATA PREVIEW</span><h2 id="preview-comparison-title">데이터 확인</h2></div><span className="workspace-subtle">{selected.rows.length ? `${start + 1}–${Math.min(start + PAGE_SIZE, selected.rows.length)} / ${selected.rows.length.toLocaleString()}행` : '0행'}</span></div><div className="comparison-tabs" role="tablist" aria-label="데이터 선택"><button type="button" role="tab" aria-selected={tab === 'original'} onClick={() => setTab('original')}>원본 데이터</button><button type="button" role="tab" aria-selected={tab === 'working'} onClick={() => setTab('working')}>정제 결과</button></div><div className="diagnosis-table-scroll" role="region" aria-label={`${tab === 'original' ? '원본' : '정제 결과'} 데이터 표`} tabIndex={0}><table><thead><tr><th scope="col" className="row-number">행</th>{selected.columns.map((name, index) => <th scope="col" key={index}>{name}</th>)}</tr></thead><tbody>{selected.rows.slice(start, start + PAGE_SIZE).map((row, offset) => { const rowIndex = start + offset; return <tr key={rowIndex} className={duplicates.has(rowIndex) ? 'duplicate-row' : ''}><th scope="row" className="row-number"><span>{rowIndex + 1}</span>{duplicates.has(rowIndex) && <small>중복</small>}</th>{row.map((value, cellIndex) => <td key={cellIndex} className={isMissing(value) ? 'missing-cell' : ''}>{isMissing(value) ? <span>빈 값</span> : value}</td>)}</tr> })}</tbody></table></div><div className="table-footer"><span><i className="legend-missing" /> 결측 셀 <i className="legend-duplicate" /> 중복 행</span><div><button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>이전</button><span>{page + 1} / {pageCount}</span><button type="button" disabled={page >= pageCount - 1} onClick={() => setPage(page + 1)}>다음</button></div></div><p className="workspace-help">행 삭제 후 행 번호가 달라질 수 있어 셀별 변경 위치는 표시하지 않습니다.</p></section>
      </main>
      <aside className="workspace-detail" aria-label="정제 결과 및 다운로드"><div className="detail-sticky comparison-panel"><span className="section-kicker">RESULT</span><h2>정제 결과</h2><dl><div><dt>원본 행</dt><dd>{comparison.original.rowCount.toLocaleString()}행</dd></div><div><dt>작업 데이터</dt><dd>{comparison.working.rowCount.toLocaleString()}행</dd></div><div><dt>제거된 행</dt><dd>{comparison.lostRows.toLocaleString()}행</dd></div><div><dt>행 손실 비율</dt><dd>{(comparison.lossRate * 100).toFixed(1)}%</dd></div></dl><p className="detail-explanation">행 손실 비율은 최초 업로드 원본 행 수를 기준으로 계산합니다. 값 대체 작업은 행을 제거하지 않습니다.</p><div className="download-section"><h3>CSV 다운로드</h3><p>현재 작업 데이터의 전체 {working.rows.length.toLocaleString()}행을 내보냅니다.</p><label>인코딩<select value={encoding} onChange={(event) => { setEncoding(event.target.value as DownloadEncoding); setMessage('') }}><option value="utf-8">UTF-8</option><option value="utf-8-bom">UTF-8 BOM · Excel 호환</option></select></label><button className="apply-cleaning" type="button" onClick={download}><Download size={16} /> CSV 다운로드</button><small>파일명: {cleanedFileName(working.fileName)}</small><p className="download-safety">스프레드시트 수식으로 해석될 수 있는 값에는 앞에 작은따옴표를 붙입니다. {riskCount > 0 ? `${riskCount.toLocaleString()}개 컬럼명/셀 값에 적용됩니다.` : '현재 해당 값은 없습니다.'} 원본과 작업 데이터는 변경되지 않습니다.</p>{message && <p className="download-message" role="status">{message}</p>}</div></div></aside>
    </div>
  </div>
}
