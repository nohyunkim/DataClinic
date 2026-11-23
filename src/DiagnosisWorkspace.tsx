import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, Columns3, FileSpreadsheet, Table2 } from 'lucide-react'
import type { ParsedCsv } from './csv'
import { analyzeData, isMissing, type InferredType } from './diagnosis'
import './workspace.css'

interface DiagnosisWorkspaceProps {
  data: ParsedCsv
  isWorking: boolean
  onUpload: () => void
  onClean: () => void
  onHome: () => void
}

const PAGE_SIZE = 20
const typeLabels: Record<InferredType, string> = {
  number: '숫자형', string: '문자열형', mixed: '혼합형', empty: '값 없음',
}
const numberLabel = (value: number) => Number.isFinite(value)
  ? value.toLocaleString('ko-KR', { maximumFractionDigits: 4 })
  : '계산 불가'

export default function DiagnosisWorkspace({ data, isWorking, onUpload, onClean, onHome }: DiagnosisWorkspaceProps) {
  const diagnosis = useMemo(() => analyzeData(data), [data])
  const [selectedColumn, setSelectedColumn] = useState(0)
  const [page, setPage] = useState(0)
  useEffect(() => { setSelectedColumn(0); setPage(0) }, [data])

  const column = diagnosis.columns[selectedColumn] ?? diagnosis.columns[0]
  const duplicateByRow = useMemo(() => new Map(diagnosis.duplicateRows.map((item) => [item.rowIndex, item.originalRowIndex])), [diagnosis])
  const pageCount = Math.max(1, Math.ceil(diagnosis.rowCount / PAGE_SIZE))
  const start = page * PAGE_SIZE
  const visibleRows = data.rows.slice(start, start + PAGE_SIZE)
  const hasIssues = diagnosis.missingCellCount > 0 || diagnosis.duplicateRows.length > 0

  return <div className="workspace-shell">
    <header className="workspace-header"><button className="workspace-brand" type="button" onClick={onHome} aria-label="DataClinic 홈"><span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span><span>Data<span>Clinic</span></span></button><div className="workspace-dataset"><FileSpreadsheet size={17} /><strong title={data.fileName}>{data.fileName}</strong></div><div className="workspace-flow" aria-label="작업 단계"><span className="done">업로드</span><ArrowRight size={13} /><span className="active">진단</span><ArrowRight size={13} /><span>정제</span><ArrowRight size={13} /><span>비교 · 준비 중</span><ArrowRight size={13} /><span>다운로드 · 준비 중</span></div></header>
    <div className="workspace-layout">
      <aside className="workspace-nav" aria-label="워크스페이스 메뉴"><p>WORKSPACE</p><a href="#overview"><Columns3 size={16} /> 구조 요약</a><a href="#quality"><CircleAlert size={16} /> 품질 진단</a><a href="#data-table"><Table2 size={16} /> 데이터 표</a><button type="button" onClick={onClean}><ArrowRight size={16} /> 데이터 정제</button><button type="button" onClick={onUpload}><ArrowLeft size={16} /> 업로드 화면</button><small>{isWorking ? '현재 작업 데이터의 진단 결과입니다.' : '원본 데이터의 진단 결과입니다.'}</small></aside>
      <main className="workspace-main"><div className="workspace-title"><span className="section-kicker">02 / DATA DIAGNOSIS</span><h1>데이터 진단</h1><p>업로드한 CSV의 구조와 결측치, 완전 중복 행을 확인하세요.</p></div>
        <section id="overview" className="workspace-card" aria-labelledby="overview-title"><div className="workspace-section-head"><div><span className="section-kicker">OVERVIEW</span><h2 id="overview-title">데이터 구조</h2></div><span className="workspace-subtle">{isWorking ? '작업 데이터 기준' : '원본 기준'}</span></div><div className="workspace-summary"><div><span>데이터 행</span><strong>{diagnosis.rowCount.toLocaleString()}</strong></div><div><span>컬럼</span><strong>{diagnosis.columnCount.toLocaleString()}</strong></div><div><span>결측 셀</span><strong>{diagnosis.missingCellCount.toLocaleString()}</strong></div><div><span>중복 행</span><strong>{diagnosis.duplicateRows.length.toLocaleString()}</strong></div></div><p className="workspace-help">결측은 빈 문자열과 공백만 있는 셀입니다. 고유값 개수는 결측 셀을 제외하고 원본 문자열로 계산합니다.</p></section>
        <section id="quality" className="workspace-card" aria-labelledby="quality-title"><div className="workspace-section-head"><div><span className="section-kicker">QUALITY CHECK</span><h2 id="quality-title">컬럼별 결측 현황</h2></div></div>{diagnosis.rowCount === 0 ? <div className="quality-ok">데이터 행이 없어 진단할 값이 없습니다.</div> : !hasIssues && <div className="quality-ok"><CheckCircle2 size={18} /> 결측 셀과 완전 중복 행이 없습니다.</div>}<div className="column-list" role="list">{diagnosis.columns.map((item) => <button type="button" role="listitem" className={`column-row${column?.index === item.index ? ' selected' : ''}`} key={item.index} onClick={() => setSelectedColumn(item.index)}><span className="column-name">{item.name}</span><span className="column-type">{typeLabels[item.type]}</span><span className="column-missing">{item.missingCount.toLocaleString()}개 <small>({(item.missingRate * 100).toFixed(1)}%)</small></span></button>)}</div><div className="duplicate-note"><strong>완전 중복 행 {diagnosis.duplicateRows.length.toLocaleString()}개</strong><p>모든 컬럼의 원본 값이 정확히 같은 경우입니다. 공백이나 대소문자를 바꾸지 않고 비교하며, 첫 행은 원본으로 두고 이후 행만 중복으로 집계합니다.</p>{diagnosis.duplicateRows.length > 0 && <p>중복 위치: {diagnosis.duplicateRows.slice(0, 8).map(({ rowIndex, originalRowIndex }) => `${rowIndex + 1}행(${originalRowIndex + 1}행과 동일)`).join(', ')}{diagnosis.duplicateRows.length > 8 ? ` 외 ${diagnosis.duplicateRows.length - 8}개` : ''}</p>}</div></section>
        <section id="data-table" className="workspace-card" aria-labelledby="table-title"><div className="workspace-section-head"><div><span className="section-kicker">DATA TABLE</span><h2 id="table-title">데이터 미리보기</h2></div><span className="workspace-subtle">{diagnosis.rowCount ? `${start + 1}–${Math.min(start + PAGE_SIZE, diagnosis.rowCount)} / ${diagnosis.rowCount.toLocaleString()}행` : '0행'}</span></div><div className="diagnosis-table-scroll" role="region" aria-label="진단 데이터 표" tabIndex={0}><table><thead><tr><th scope="col" className="row-number">행</th>{data.columns.map((name, index) => <th scope="col" key={index} className={column?.index === index ? 'selected-column' : ''}><button type="button" onClick={() => setSelectedColumn(index)}>{name}</button></th>)}</tr></thead><tbody>{visibleRows.map((row, offset) => { const rowIndex = start + offset; const original = duplicateByRow.get(rowIndex); return <tr key={rowIndex} className={original === undefined ? '' : 'duplicate-row'}><th scope="row" className="row-number"><span>{rowIndex + 1}</span>{original !== undefined && <small>중복</small>}</th>{row.map((value, cellIndex) => <td key={cellIndex} className={`${isMissing(value) ? 'missing-cell' : ''}${column?.index === cellIndex ? ' selected-column' : ''}`} title={original === undefined ? undefined : `${original + 1}행과 완전 중복`}>{isMissing(value) ? <span>빈 값</span> : value}</td>)}</tr> })}</tbody></table></div>{diagnosis.rowCount === 0 && <p className="empty-table">데이터 행이 없습니다.</p>}<div className="table-footer"><span><i className="legend-missing" /> 결측 셀 <i className="legend-duplicate" /> 중복 행</span><div><button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>이전</button><span>{page + 1} / {pageCount}</span><button type="button" disabled={page >= pageCount - 1} onClick={() => setPage(page + 1)}>다음</button></div></div></section>
      </main>
      <aside className="workspace-detail" aria-label="선택한 컬럼 상세"><div className="detail-sticky"><span className="section-kicker">COLUMN DETAIL</span>{column ? <><h2>{column.name}</h2><span className="detail-type">{typeLabels[column.type]}</span><dl><div><dt>결측 셀</dt><dd>{column.missingCount.toLocaleString()}개 · {(column.missingRate * 100).toFixed(1)}%</dd></div><div><dt>고유값</dt><dd>{column.uniqueCount.toLocaleString()}개</dd></div></dl><p className="detail-explanation">{diagnosis.rowCount === 0 ? '데이터 행이 없어 결측 상태를 판단할 값이 없습니다.' : column.missingCount === 0 ? '이 컬럼에는 결측 셀이 없습니다.' : column.missingCount === diagnosis.rowCount ? '모든 데이터 행의 값이 비어 있습니다.' : `${column.missingRowIndices.slice(0, 8).map((index) => index + 1).join(', ')}${column.missingCount > 8 ? ' 외' : ''}행에 빈 값 또는 공백만 있는 셀이 있습니다.`}</p>{column.type === 'mixed' && <p className="detail-explanation">숫자로 읽을 수 있는 값과 문자열이 섞여 있어 숫자 통계를 계산하지 않았습니다.</p>}{column.type === 'empty' && <p className="detail-explanation">유효한 값이 없어 자료형을 추론할 수 없습니다.</p>}{column.type === 'number' && <div className="detail-stats"><h3>숫자 기초 통계</h3>{column.stats ? <dl><div><dt>유효값</dt><dd>{column.stats.validCount.toLocaleString()}개</dd></div><div><dt>최솟값</dt><dd>{numberLabel(column.stats.min)}</dd></div><div><dt>최댓값</dt><dd>{numberLabel(column.stats.max)}</dd></div><div><dt>평균</dt><dd>{numberLabel(column.stats.mean)}</dd></div><div><dt>중앙값</dt><dd>{numberLabel(column.stats.median)}</dd></div></dl> : <p>숫자 범위가 너무 커 통계를 표시할 수 없습니다.</p>}</div>}<div className="detail-future">정제 기능은 다음 단계에서 연결됩니다. 이 화면에서는 원본 값을 변경하지 않습니다.</div></> : <p className="detail-explanation">선택할 컬럼이 없습니다.</p>}</div></aside>
    </div>
  </div>
}
