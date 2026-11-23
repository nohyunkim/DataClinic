import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, FileSpreadsheet, UploadCloud } from 'lucide-react'
import { CsvValidationError, parseCsvFile, type CsvEncoding, type ParsedCsv } from './csv'
import { createSampleFile } from './sampleCsv'

type UploadStatus = 'idle' | 'processing' | 'success' | 'error'

interface UploadScreenProps {
  initialSample: boolean
  parsed: ParsedCsv | null
  onParsed: (data: ParsedCsv | null) => void
  onBack: () => void
}

export default function UploadScreen({ initialSample, parsed, onParsed, onBack }: UploadScreenProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const requestId = useRef(0)
  const startedSample = useRef(false)
  const [file, setFile] = useState<File | null>(null)
  const [encoding, setEncoding] = useState<CsvEncoding>('utf-8')
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [message, setMessage] = useState('')
  const [dragging, setDragging] = useState(false)

  const loadFile = useCallback(async (nextFile: File, nextEncoding: CsvEncoding) => {
    const currentRequest = ++requestId.current
    setFile(nextFile)
    setStatus('processing')
    setMessage('')
    onParsed(null)
    try {
      const result = await parseCsvFile(nextFile, nextEncoding)
      if (currentRequest !== requestId.current) return
      onParsed(result)
      setStatus('success')
    } catch (error) {
      if (currentRequest !== requestId.current) return
      setMessage(error instanceof CsvValidationError ? error.message : '파일을 처리하지 못했습니다. 다시 시도해 주세요.')
      setStatus('error')
    }
  }, [onParsed])

  useEffect(() => {
    if (initialSample && !startedSample.current) {
      startedSample.current = true
      void loadFile(createSampleFile(), 'utf-8')
    }
  }, [initialSample, loadFile])

  const selectFile = (nextFile: File | undefined) => {
    if (nextFile) void loadFile(nextFile, encoding)
  }

  return <main className="upload-page container">
    <button className="back-link" type="button" onClick={onBack}><ArrowLeft size={17} /> 랜딩 페이지로</button>
    <div className="upload-heading"><span className="section-kicker">01 / CSV 업로드</span><h1>데이터를 먼저 살펴볼게요</h1><p>CSV 파일을 선택하면 컬럼과 처음 10개 행을 미리 보여드립니다.</p></div>
    <div className="workflow-steps" aria-label="작업 단계"><span className="current">업로드</span><span>진단</span><span>정제</span><span>비교</span><span>다운로드</span></div>
    <section className="upload-panel" aria-label="CSV 파일 업로드">
      <div className="upload-panel-heading"><div><h2>CSV 파일 선택</h2><p>UTF-8(또는 UTF-8 BOM) 파일을 기본으로 읽습니다. 한국어가 깨지면 CP949로 바꿔 다시 파싱하세요.</p></div><label className="encoding-field">인코딩<select value={encoding} onChange={(event) => { const next = event.target.value as CsvEncoding; setEncoding(next); if (file) void loadFile(file, next) }}><option value="utf-8">UTF-8</option><option value="euc-kr">CP949</option></select></label></div>
      <input ref={inputRef} className="visually-hidden" type="file" accept=".csv,text/csv" onChange={(event) => { selectFile(event.target.files?.[0]); event.target.value = '' }} aria-label="CSV 파일 선택" />
      <div className={`drop-zone${dragging ? ' is-dragging' : ''}`} onDragEnter={(event) => { event.preventDefault(); setDragging(true) }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { event.preventDefault(); setDragging(false) }} onDrop={(event) => { event.preventDefault(); setDragging(false); selectFile(event.dataTransfer.files[0]) }}>
        <span className="drop-icon"><UploadCloud size={28} strokeWidth={1.7} /></span><strong>CSV 파일을 여기에 놓으세요</strong><span>또는 아래 버튼으로 파일을 선택하세요</span><button className="primary-button" type="button" onClick={() => inputRef.current?.click()} disabled={status === 'processing'}>파일 선택</button><small>CSV 형식 · 최대 5MB · 브라우저 안에서만 처리</small>
      </div>
      <button className="sample-action" type="button" onClick={() => { setEncoding('utf-8'); void loadFile(createSampleFile(), 'utf-8') }} disabled={status === 'processing'}>예시 데이터로 체험</button>
      <div className="upload-feedback" role="status" aria-live="polite">
        {status === 'processing' && <p>CSV 파일을 읽고 검증하는 중입니다…</p>}
        {status === 'error' && <p className="error-message">{message}</p>}
        {status === 'success' && <p className="success-message"><Check size={16} /> 파일을 읽었습니다. 진단 결과가 준비되었습니다.</p>}
      </div>
    </section>
    {status === 'success' && parsed && <section className="data-panel" aria-labelledby="data-preview-title"><div className="data-panel-heading"><div><span className="section-kicker">DATA PREVIEW</span><h2 id="data-preview-title">데이터 미리보기</h2></div><span className="file-pill"><FileSpreadsheet size={16} /> {parsed.fileName}</span></div><div className="data-facts"><span><strong>{parsed.rows.length.toLocaleString()}</strong> 데이터 행</span><span><strong>{parsed.columns.length}</strong> 컬럼</span><span><strong>{(parsed.fileSize / 1024).toFixed(1)} KB</strong> 파일 크기</span><span><strong>{parsed.encoding === 'utf-8' ? 'UTF-8' : 'CP949'}</strong> 인코딩</span></div><div className="table-scroll" role="region" aria-label="CSV 처음 10개 행" tabIndex={0}><table><thead><tr>{parsed.columns.map((column, index) => <th key={index} scope="col">{column}</th>)}</tr></thead><tbody>{parsed.rows.slice(0, 10).map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell || <span className="empty-cell">빈 값</span>}</td>)}</tr>)}</tbody></table></div><p className="preview-note">처음 10개 행만 표시합니다. 진단 결과는 진단 화면에서 확인할 수 있습니다.</p></section>}
  </main>
}
