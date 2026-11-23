import { useState } from 'react'
import { ArrowRight, Check, ChevronDown, CircleAlert, Columns3, FileSpreadsheet, GitCompareArrows, Menu, ScanSearch, ShieldCheck, Sparkles, WandSparkles } from 'lucide-react'
import UploadScreen from './UploadScreen'
import type { ParsedCsv } from './csv'

const features = [
  { icon: ScanSearch, number: '01', title: '데이터 진단', description: 'CSV의 빈 값과 중복 행을 찾아 데이터 상태를 한눈에 파악합니다.', tag: '문제 위치 확인' },
  { icon: WandSparkles, number: '02', title: '간단한 정제', description: '필요한 정제 방법을 직접 선택하고 적용 전 영향을 미리 살펴봅니다.', tag: '내가 선택하는 정제' },
  { icon: GitCompareArrows, number: '03', title: '변화 비교', description: '원본과 정제 후의 차이를 확인해 어떤 변화가 생겼는지 이해합니다.', tag: '전후 결과 비교' },
]

function Logo() {
  return <a className="brand" href="#top" aria-label="DataClinic 홈"><span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span><span>Data<span className="brand-accent">Clinic</span></span></a>
}

function DiagnosticPreview() {
  return <div className="preview-stage" aria-label="CSV 진단 결과 예시 화면">
    <div className="preview-halo" />
    <div className="floating-file" aria-hidden="true"><span className="floating-file-icon"><FileSpreadsheet size={22} strokeWidth={1.8} /></span><span><strong>sales_data.csv</strong><small>CSV 파일 예시</small></span><Check size={16} className="floating-file-check" /></div>
    <div className="diagnostic-card">
      <div className="card-topline"><div className="window-dots" aria-hidden="true"><i /><i /><i /></div><span className="sample-badge">예시 화면</span></div>
      <div className="diagnostic-heading"><div><span className="eyebrow">DATA OVERVIEW</span><h2>데이터 진단 결과</h2><p>파일의 상태를 간단히 살펴보세요.</p></div><span className="heading-icon"><Columns3 size={21} strokeWidth={1.8} /></span></div>
      <div className="metric-grid"><div className="metric"><span>전체 행</span><strong>1,248</strong><small>rows</small></div><div className="metric"><span>컬럼</span><strong>8</strong><small>columns</small></div><div className="metric metric-blue"><span>결측 셀</span><strong>24</strong><small>개 · 예시</small></div></div>
      <div className="results-heading"><span>발견된 항목</span><span>2개 항목</span></div>
      <div className="result-row"><span className="result-icon alert"><CircleAlert size={17} /></span><span className="result-copy"><strong>빈 값이 있는 셀</strong><small>customer_email 컬럼</small></span><span className="result-count">24건</span></div>
      <div className="result-row"><span className="result-icon info"><Check size={17} /></span><span className="result-copy"><strong>중복된 행</strong><small>동일한 내용의 데이터</small></span><span className="result-count">3건</span></div>
      <div className="preview-footnote"><ShieldCheck size={15} /> 이해하기 쉬운 데이터 상태 요약</div>
    </div>
    <div className="floating-summary" aria-hidden="true"><span className="summary-icon"><Sparkles size={18} /></span><span><strong>문제를 발견했어요</strong><small>이제 필요한 정제를 선택하세요</small></span></div>
  </div>
}

function App() {
  const [uploadOpen, setUploadOpen] = useState(false)
  const [initialSample, setInitialSample] = useState(false)
  const [parsed, setParsed] = useState<ParsedCsv | null>(null)

  if (uploadOpen) {
    return <div id="top" className="site-shell"><header className="site-header"><div className="container header-inner"><Logo /><span className="header-status">CSV 업로드</span></div></header><UploadScreen initialSample={initialSample} parsed={parsed} onParsed={setParsed} onBack={() => { setUploadOpen(false); setInitialSample(false) }} /></div>
  }

  return <div id="top" className="site-shell">
    <header className="site-header"><div className="container header-inner"><Logo /><nav className="desktop-nav" aria-label="주요 메뉴"><a href="#features">주요 기능</a><a href="#how-it-works">이용 흐름</a></nav><div className="header-right"><span className="header-status">업로드 사용 가능 · 진단 준비 중</span><a className="header-link" href="#features">서비스 살펴보기 <ArrowRight size={15} /></a><a className="mobile-menu" href="#features" aria-label="주요 기능으로 이동"><Menu size={22} /></a></div></div></header>
    <main>
      <section className="hero container" aria-labelledby="hero-title"><div className="hero-copy"><div className="announcement"><span className="announcement-dot" /> CSV 데이터 정제, 더 명확한 시작 <ArrowRight size={14} /></div><h1 id="hero-title">데이터 정제의 시작,<br /><span>DataClinic</span></h1><p className="hero-description">복잡한 데이터도 어디서부터 손봐야 할지 알 수 있도록.<br className="desktop-break" /> CSV의 문제를 살펴보고, 필요한 정제를 선택하고,<br className="desktop-break" /> 달라진 결과까지 확인하세요.</p><div className="hero-actions" aria-describedby="availability-note"><button className="primary-button" type="button" onClick={() => { setInitialSample(false); setUploadOpen(true) }}>지금 분석해보기 <ArrowRight size={18} /></button><button className="secondary-button" type="button" onClick={() => { setInitialSample(true); setUploadOpen(true) }}>예시 데이터로 체험</button></div><p id="availability-note" className="availability-note">CSV 업로드와 미리보기를 사용할 수 있습니다. 데이터 진단과 정제는 준비 중입니다.</p><div className="hero-assurance"><span><Check size={15} /> 설치 없이 브라우저에서</span><span><Check size={15} /> 원본 데이터를 기준으로</span></div></div><DiagnosticPreview /></section>
      <section className="feature-section" id="features" aria-labelledby="features-title"><div className="container"><div className="section-heading"><div><span className="section-kicker">주요 기능</span><h2 id="features-title">데이터를 이해하는<br />세 가지 단계</h2></div><p>문제를 찾는 순간부터 달라진 결과를 확인할 때까지,<br className="desktop-break" /> 필요한 과정만 간결하게 이어집니다.</p></div><div className="feature-grid">{features.map(({ icon: Icon, number, title, description, tag }) => <article className="feature-card" key={number}><div className="feature-card-top"><span className="feature-icon"><Icon size={24} strokeWidth={1.8} /></span><span className="feature-number">{number}</span></div><h3>{title}</h3><p>{description}</p><span className="feature-tag">{tag}</span></article>)}</div></div></section>
      <section className="process-section container" id="how-it-works" aria-labelledby="process-title"><div className="process-copy"><span className="section-kicker">이용 흐름</span><h2 id="process-title">데이터를 바꾸기 전에,<br />먼저 이해하세요.</h2><p>DataClinic은 문제를 보여주고, 정제의 영향을 살펴본 뒤, 사용자가 직접 적용을 결정하는 흐름을 지향합니다.</p></div><div className="process-steps" aria-label="서비스 이용 흐름"><span>CSV 선택</span><ArrowRight size={18} /><span>문제 확인</span><ArrowRight size={18} /><span>정제 선택</span><ArrowRight size={18} /><span>변화 비교</span></div></section>
    </main>
    <footer className="site-footer"><div className="container footer-inner"><Logo /><span>데이터를 더 명확하게, DataClinic</span><a href="#top">맨 위로 <ChevronDown size={15} /></a></div></footer>
  </div>
}

export default App
