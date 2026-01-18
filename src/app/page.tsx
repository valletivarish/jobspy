'use client';

import { useState, useRef, useEffect } from 'react';

// Feature flag for AI features (controlled via .env.local)
const AI_ENABLED = process.env.NEXT_PUBLIC_ENABLE_AI === 'true';


// Reliable sources - consistently work without blocking
const RELIABLE_SITES = [
  { id: 'remoteok', name: 'RemoteOK' },
  { id: 'arbeitnow', name: 'Arbeitnow' },
  { id: 'hackernews', name: 'HN Jobs' },
  { id: 'jobspresso', name: 'Jobspresso' },
];

// Experimental sources - may get blocked or timeout
const EXPERIMENTAL_SITES = [
  { id: 'himalayas', name: 'Himalayas' },
  { id: 'remoteco', name: 'Remote.co' },
  { id: 'startupjobs', name: 'Startup Jobs' },
  { id: 'wellfound', name: 'Wellfound' },
  { id: 'indeed', name: 'Indeed' },
  { id: 'naukri', name: 'Naukri' },
  { id: 'google', name: 'Google Jobs' },
  { id: 'simplyhired', name: 'SimplyHired' },
  { id: 'dice', name: 'Dice' },
];

const ALL_SITES = [...RELIABLE_SITES, ...EXPERIMENTAL_SITES];


const COUNTRIES = [
  "India", "USA", "United Kingdom", "Canada", "Australia", "Germany",
  "Singapore", "Netherlands", "France", "Japan", "Remote"
];

const JOB_TYPES = [
  { id: '', name: 'All' },
  { id: 'fulltime', name: 'Full Time' },
  { id: 'parttime', name: 'Part Time' },
  { id: 'internship', name: 'Internship' },
  { id: 'contract', name: 'Contract' },
];

interface Job {
  title: string;
  company: string;
  location: string;
  site: string;
  job_url: string;
  matchScore?: number;
  matchReason?: string;
}

interface Analysis {
  matchScore: number;
  strengths: string[];
  gaps: string[];
  tips: string[];
}

interface SourceStatus {
  count: number;
  error?: string;
}

export default function Home() {
  const [searchTerm, setSearchTerm] = useState('software engineer');
  const [location, setLocation] = useState('');
  const [selectedSites, setSelectedSites] = useState(['remoteok', 'arbeitnow', 'hackernews', 'jobspresso']);
  const [country, setCountry] = useState('Remote');
  const [jobType, setJobType] = useState('');
  const [resultsWanted, setResultsWanted] = useState(30);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'cards' | 'table'>('cards');
  const [sourceStatus, setSourceStatus] = useState<Record<string, SourceStatus>>({});

  const [resume, setResume] = useState('');
  const [resumeFileName, setResumeFileName] = useState('');
  const [showAI, setShowAI] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [coverLetter, setCoverLetter] = useState('');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [showModal, setShowModal] = useState<'cover' | 'analysis' | 'message' | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [savedJobs, setSavedJobs] = useState<Job[]>([]);
  const [sortBy, setSortBy] = useState<'match' | 'title' | 'company' | 'site'>('site');
  const [filterSite, setFilterSite] = useState<string>('all');
  const [filterText, setFilterText] = useState<string>('');
  const [recruiterMessage, setRecruiterMessage] = useState('');
  const [viewMode, setViewMode] = useState<'search' | 'saved'>('search');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('jobspy_saved');
    if (saved) setSavedJobs(JSON.parse(saved));
  }, []);

  const saveToLocal = (jobs: Job[]) => {
    localStorage.setItem('jobspy_saved', JSON.stringify(jobs));
  };

  const toggleSaveJob = (job: Job) => {
    const isSaved = savedJobs.some(s => s.job_url === job.job_url);
    const updated = isSaved
      ? savedJobs.filter(s => s.job_url !== job.job_url)
      : [...savedJobs, job];
    setSavedJobs(updated);
    saveToLocal(updated);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/parse-resume', { method: 'POST', body: formData });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setResume(data.text);
      setResumeFileName(file.name);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Failed to parse');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleSearch = async (page: number = 1) => {
    if (!selectedSites.length) return setError('Select at least one site');
    setLoading(true);
    setError('');
    setCurrentPage(page);
    setSourceStatus({});

    try {
      const locationStr = location ? `${location}, ${country}` : country;
      const res = await fetch('/api/scrape-js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sites: selectedSites,
          search_term: searchTerm,
          location: locationStr,
          results_wanted: resultsWanted,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setJobs(data.jobs || []);
      setSourceStatus(data.meta?.sources || {});

      if (data.jobs?.length === 0) {
        setError('No jobs found. Try different keywords or sources.');
      }
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAIMatch = async () => {
    if (!resume) return setError('Upload resume first');
    if (!jobs.length) return setError('Search for jobs first');
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'match', resume, jobs: jobs.slice(0, 20) }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      const updated = [...jobs];
      data.matches?.forEach((m: { index: number; score: number; reason: string }) => {
        if (updated[m.index]) {
          updated[m.index].matchScore = m.score;
          updated[m.index].matchReason = m.reason;
        }
      });
      updated.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
      setJobs(updated);
      setSortBy('match');
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'AI matching failed');
    } finally {
      setAiLoading(false);
    }
  };

  const handleCoverLetter = async (job: Job) => {
    if (!resume) return;
    setSelectedJob(job);
    setAiLoading(true);
    setShowModal('cover');
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cover-letter', resume, job }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setCoverLetter(data.coverLetter);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Failed');
      setShowModal(null);
    } finally {
      setAiLoading(false);
    }
  };

  const handleAnalyze = async (job: Job) => {
    if (!resume) return;
    setSelectedJob(job);
    setAiLoading(true);
    setShowModal('analysis');
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze', resume, job }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setAnalysis(data.analysis);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Failed');
      setShowModal(null);
    } finally {
      setAiLoading(false);
    }
  };

  const handleMessage = async (job: Job) => {
    if (!resume) return;
    setSelectedJob(job);
    setAiLoading(true);
    setShowModal('message');
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'message', resume, job }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setRecruiterMessage(data.message);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Failed');
      setShowModal(null);
    } finally {
      setAiLoading(false);
    }
  };

  const downloadExcel = () => {
    if (!jobs.length) return;
    const esc = (s: any) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const xml = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Jobs"><Table><Row><Cell><Data ss:Type="String">Title</Data></Cell><Cell><Data ss:Type="String">Company</Data></Cell><Cell><Data ss:Type="String">Location</Data></Cell><Cell><Data ss:Type="String">Source</Data></Cell><Cell><Data ss:Type="String">Match</Data></Cell><Cell><Data ss:Type="String">URL</Data></Cell></Row>${jobs.map(j => `<Row><Cell><Data ss:Type="String">${esc(j.title)}</Data></Cell><Cell><Data ss:Type="String">${esc(j.company)}</Data></Cell><Cell><Data ss:Type="String">${esc(j.location)}</Data></Cell><Cell><Data ss:Type="String">${esc(j.site)}</Data></Cell><Cell><Data ss:Type="Number">${j.matchScore || ''}</Data></Cell><Cell><Data ss:Type="String">${esc(j.job_url)}</Data></Cell></Row>`).join('')}</Table></Worksheet></Workbook>`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([xml], { type: 'application/vnd.ms-excel' }));
    a.download = `jobs_${new Date().toISOString().slice(0, 10)}.xls`;
    a.click();
  };

  const displayedJobs = (viewMode === 'saved' ? savedJobs : jobs)
    .filter(j => filterSite === 'all' || j.site === filterSite)
    .filter(j => {
      if (!filterText.trim()) return true;
      const search = filterText.toLowerCase();
      return j.title.toLowerCase().includes(search) || j.company.toLowerCase().includes(search);
    })
    .sort((a, b) => {
      if (sortBy === 'match') return (b.matchScore || 0) - (a.matchScore || 0);
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'company') return a.company.localeCompare(b.company);
      if (sortBy === 'site') return a.site.localeCompare(b.site);
      return 0;
    });

  const getSiteBadgeColor = (site: string): string => {
    const colors: Record<string, string> = {
      remoteok: '#00d4aa',
      hackernews: '#ff6600',
      arbeitnow: '#667eea',
      himalayas: '#6366f1',
      remoteco: '#10b981',
      jobspresso: '#e74c3c',
      startupjobs: '#f59e0b',
      wellfound: '#000000',
      indeed: '#2557a7',
      naukri: '#4a90d9',
      google: '#4285f4',
      simplyhired: '#8e44ad',
      dice: '#eb5757',
    };
    return colors[site] || '#6b7280';
  };

  return (
    <main>
      <header className="header">
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <span className="logo">JobSpy</span>
            <span className="logo-sub">Multi-Source Job Search</span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="tab-group" style={{ height: 36 }}>
              <button onClick={() => setViewMode('search')} className={`tab-btn ${viewMode === 'search' ? 'active' : ''}`}>Search</button>
              <button onClick={() => setViewMode('saved')} className={`tab-btn ${viewMode === 'saved' ? 'active' : ''}`}>Saved ({savedJobs.length})</button>
            </div>
            {AI_ENABLED && (
              <button onClick={() => setShowAI(!showAI)} className={`btn-secondary`} style={showAI ? { background: 'var(--accent-glow)', borderColor: 'var(--accent)' } : {}}>
                {showAI ? 'Close AI' : 'AI Assistant'}
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="container">
        {AI_ENABLED && showAI && (
          <section className="section fade-in">
            <div className="card shadow-lg" style={{ borderColor: 'var(--accent)', background: 'var(--bg-card)' }}>
              <h2 className="section-title">AI Resume Assistant</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: 16, fontSize: 13 }}>
                Upload your resume or paste/edit the text below for AI-powered job matching.
              </p>

              <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" onChange={handleFileUpload} style={{ display: 'none' }} />

              <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', marginBottom: 16 }}>
                <div onClick={() => fileInputRef.current?.click()} className={`upload-area ${resumeFileName ? 'uploaded' : ''}`} style={{ flex: '0 0 200px', minHeight: 80, cursor: 'pointer' }}>
                  {uploadLoading ? (
                    <div className="spinner" />
                  ) : (
                    <>
                      <div style={{ fontWeight: 600, color: resumeFileName ? 'var(--success)' : 'inherit' }}>{resumeFileName || 'Upload File'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>PDF, DOCX, TXT</div>
                    </>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <textarea
                    value={resume}
                    onChange={(e) => setResume(e.target.value)}
                    placeholder="Paste your resume text here, or upload a file to extract text automatically..."
                    className="input"
                    style={{
                      width: '100%',
                      height: 120,
                      resize: 'vertical',
                      fontFamily: 'inherit',
                      fontSize: 13,
                      lineHeight: 1.5
                    }}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    {resume.length > 0 ? `${resume.length} characters` : 'No resume text yet'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button onClick={handleAIMatch} disabled={aiLoading || !jobs.length || !resume} className="btn-primary" style={{ height: 40, flex: 1 }}>
                  {aiLoading ? 'Analyzing...' : 'Match All Jobs'}
                </button>
                <button onClick={() => setResume('')} disabled={!resume} className="btn-secondary" style={{ height: 40 }}>
                  Clear
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>
                {jobs.length ? `${jobs.length} jobs available for analysis` : 'Search for jobs first'}
              </div>
            </div>
          </section>
        )}

        {viewMode === 'search' && (
          <section className="section fade-in">
            <div className="card shadow-lg">
              <h2 className="section-title">Job Search</h2>
              <div className="form-grid">
                <div className="form-group">
                  <label className="label">Keywords</label>
                  <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="input" placeholder="e.g. React Developer" />
                </div>
                <div className="form-group">
                  <label className="label">City (Optional)</label>
                  <input type="text" value={location} onChange={e => setLocation(e.target.value)} className="input" placeholder="e.g. San Francisco" />
                </div>
                <div className="form-group">
                  <label className="label">Country/Region</label>
                  <select value={country} onChange={e => setCountry(e.target.value)} className="select">
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">Job Type</label>
                  <select value={jobType} onChange={e => setJobType(e.target.value)} className="select">
                    {JOB_TYPES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, margin: '16px 0' }}>
                <div className="form-group" style={{ width: 100 }}>
                  <label className="label">Results</label>
                  <select value={resultsWanted} onChange={e => setResultsWanted(Number(e.target.value))} className="select">
                    {[10, 20, 30, 50, 100].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label className="label">Reliable Sources</label>
                <div className="flex flex-wrap gap-3" style={{ marginBottom: 12 }}>
                  {RELIABLE_SITES.map((site) => (
                    <button
                      key={site.id}
                      onClick={() => {
                        setSelectedSites(prev =>
                          prev.includes(site.id) ? prev.filter(x => x !== site.id) : [...prev, site.id]
                        );
                      }}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${selectedSites.includes(site.id)
                        ? 'bg-blue-600/10 border-blue-500/30 text-blue-400'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                        }`}
                      style={selectedSites.includes(site.id) ? { borderColor: getSiteBadgeColor(site.id), color: getSiteBadgeColor(site.id) } : {}}
                    >
                      {site.name}
                    </button>
                  ))}
                </div>
                <label className="label" style={{ color: 'var(--text-muted)', fontSize: 10 }}>Experimental (may be blocked)</label>
                <div className="flex flex-wrap gap-3">
                  {EXPERIMENTAL_SITES.map((site) => (
                    <button
                      key={site.id}
                      onClick={() => {
                        setSelectedSites(prev =>
                          prev.includes(site.id) ? prev.filter(x => x !== site.id) : [...prev, site.id]
                        );
                      }}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${selectedSites.includes(site.id)
                        ? 'bg-blue-600/10 border-blue-500/30 text-blue-400'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                        }`}
                      style={{
                        opacity: selectedSites.includes(site.id) ? 1 : 0.6,
                        ...(selectedSites.includes(site.id) ? { borderColor: getSiteBadgeColor(site.id), color: getSiteBadgeColor(site.id) } : {})
                      }}
                    >
                      {site.name}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                  Selected: {selectedSites.length} sources
                </div>
              </div>

              <button onClick={() => handleSearch(1)} disabled={loading} className="btn-primary" style={{ height: 44, fontSize: 15 }}>
                {loading ? <><div className="spinner" /> Scraping...</> : 'Find Jobs'}
              </button>

              {error && <div className="error-box">{error}</div>}

              {/* Source Status - Only show summary, not wall of errors */}
              {Object.keys(sourceStatus).length > 0 && (() => {
                const successful = Object.entries(sourceStatus).filter(([, s]) => !s.error && s.count > 0);
                const failed = Object.entries(sourceStatus).filter(([, s]) => s.error);
                const totalJobs = Object.values(sourceStatus).reduce((sum, s) => sum + s.count, 0);

                return (
                  <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-dark)', borderRadius: 8, fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        Found <strong style={{ color: 'var(--success)' }}>{totalJobs}</strong> jobs from{' '}
                        <strong>{successful.length}</strong> sources
                      </span>
                      {failed.length > 0 && (
                        <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                          {failed.length} source{failed.length > 1 ? 's' : ''} unavailable
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </section>
        )}

        {viewMode === 'saved' && (
          <section className="section fade-in">
            <div className="card shadow-md" style={{ borderStyle: 'dashed', background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 className="section-title" style={{ margin: 0 }}>Saved Jobs</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
                    {savedJobs.length} jobs bookmarked. These persist across searches.
                  </p>
                </div>
                {savedJobs.length > 0 && (
                  <button onClick={() => { if (confirm('Clear all?')) { setSavedJobs([]); saveToLocal([]); } }} className="btn-secondary" style={{ color: 'var(--error)', height: 32, fontSize: 12 }}>
                    Clear All
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        {(jobs.length > 0 || (viewMode === 'saved' && savedJobs.length > 0)) && (
          <section className="section" style={{ paddingTop: 0 }}>
            <div className="actions-bar">
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div className="tab-group" style={{ height: 32 }}>
                  <button onClick={() => setActiveTab('cards')} className={`tab-btn ${activeTab === 'cards' ? 'active' : ''}`} style={{ fontSize: 11 }}>Cards</button>
                  <button onClick={() => setActiveTab('table')} className={`tab-btn ${activeTab === 'table' ? 'active' : ''}`} style={{ fontSize: 11 }}>Table</button>
                </div>

                <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="select" style={{ width: 110, height: 32, fontSize: 11, color: '#fafafa', backgroundColor: '#0a0a0a' }}>
                  <option value="match">Sort: Match</option>
                  <option value="site">Sort: Source</option>
                  <option value="title">Sort: Title</option>
                  <option value="company">Sort: Company</option>
                </select>

                <select value={filterSite} onChange={e => setFilterSite(e.target.value)} className="select" style={{ width: 130, height: 32, fontSize: 11, color: '#fafafa', backgroundColor: '#0a0a0a' }}>
                  <option value="all">Filter: All Sites</option>
                  {[...new Set((viewMode === 'saved' ? savedJobs : jobs).map(j => j.site))].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>

                <input
                  type="text"
                  value={filterText}
                  onChange={e => setFilterText(e.target.value)}
                  placeholder="Filter by title..."
                  className="input"
                  style={{ width: 150, height: 32, fontSize: 11, padding: '0 10px' }}
                />
              </div>
              <button onClick={downloadExcel} className="btn-secondary" style={{ height: 32, fontSize: 11 }}>Export XLS</button>
            </div>

            {activeTab === 'cards' ? (
              <div className="job-list">
                {displayedJobs.map((job, i) => (
                  <div key={i} className="job-card fade-in" style={{ animationDelay: `${i * 0.03}s` }}>
                    <div className="job-info">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="job-title">{job.title}</span>
                        {job.matchScore && (
                          <span className={`match-score ${job.matchScore >= 80 ? 'match-high' : job.matchScore >= 60 ? 'match-medium' : 'match-low'}`}>
                            {job.matchScore}%
                          </span>
                        )}
                      </div>
                      <div className="job-company">{job.company}</div>
                      <div className="job-location">{job.location}</div>
                    </div>
                    <div className="job-actions">
                      <button onClick={() => toggleSaveJob(job)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12, borderColor: savedJobs.some(s => s.job_url === job.job_url) ? 'var(--accent)' : '' }}>
                        {savedJobs.some(s => s.job_url === job.job_url) ? 'Saved' : 'Save'}
                      </button>
                      <span className="badge" style={{ background: getSiteBadgeColor(job.site), color: '#fff' }}>{job.site}</span>
                      {AI_ENABLED && showAI && resume && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => handleCoverLetter(job)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>Letter</button>
                          <button onClick={() => handleAnalyze(job)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>Stats</button>
                          <button onClick={() => handleMessage(job)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>Message</button>
                        </div>
                      )}
                      {job.job_url && <a href={job.job_url} target="_blank" rel="noopener noreferrer" className="apply-link">Apply</a>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="table-container fade-in">
                <table className="table">
                  <thead><tr><th>Title</th><th>Company</th><th>Match</th><th>Source</th><th>Actions</th></tr></thead>
                  <tbody>
                    {displayedJobs.map((job, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 500 }}>{job.title}</td>
                        <td style={{ color: 'var(--accent-light)' }}>{job.company}</td>
                        <td>{job.matchScore ? <span className={`match-score ${job.matchScore >= 80 ? 'match-high' : 'match-medium'}`}>{job.matchScore}%</span> : '-'}</td>
                        <td><span className="badge" style={{ background: getSiteBadgeColor(job.site), color: '#fff' }}>{job.site}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => toggleSaveJob(job)} className="btn-secondary" style={{ padding: '4px 8px', fontSize: 10 }}>{savedJobs.some(s => s.job_url === job.job_url) ? 'Saved' : 'Save'}</button>
                            <a href={job.job_url} target="_blank" rel="noopener noreferrer" className="apply-link" style={{ padding: '4px 8px', fontSize: 10 }}>Apply</a>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {viewMode === 'search' && jobs.length >= 10 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginTop: 30, padding: '20px 0' }}>
                <span style={{ fontWeight: 600, color: 'var(--accent)' }}>Showing {displayedJobs.length} jobs</span>
              </div>
            )}
          </section>
        )}

        {!loading && jobs.length === 0 && viewMode === 'search' && (
          <div className="empty-state">
            <div className="empty-title">Ready to Search</div>
            <div className="empty-text">Select job sources and find your next opportunity</div>
          </div>
        )}
      </div>

      {/* AI Modal */}
      {showModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div className="modal-card" style={{ background: 'var(--bg-card)', borderRadius: 16, maxWidth: 600, width: '100%', maxHeight: '85vh', overflow: 'auto', padding: 32, border: '1px solid var(--border)', position: 'relative' }}>
            <button onClick={() => setShowModal(null)} style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 24, cursor: 'pointer' }}>×</button>

            {aiLoading ? (
              <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" style={{ margin: '0 auto 16px' }} /><p style={{ color: 'var(--text-muted)' }}>AI is working...</p></div>
            ) : showModal === 'cover' ? (
              <div className="fade-in">
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>Custom Cover Letter</h3>
                <div style={{ background: 'var(--bg-dark)', padding: 24, borderRadius: 12, whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: 14, color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>{coverLetter}</div>
                <button onClick={() => { navigator.clipboard.writeText(coverLetter); alert('Copied!'); }} className="btn-primary" style={{ marginTop: 24, width: '100%' }}>Copy to Clipboard</button>
              </div>
            ) : showModal === 'message' ? (
              <div className="fade-in">
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>Recruiter Outreach</h3>
                <div style={{ background: 'var(--bg-dark)', padding: 24, borderRadius: 12, whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: 14, color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>{recruiterMessage}</div>
                <button onClick={() => { navigator.clipboard.writeText(recruiterMessage); alert('Copied!'); }} className="btn-primary" style={{ marginTop: 24, width: '100%' }}>Copy Message</button>
              </div>
            ) : analysis && (
              <div className="fade-in">
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>AI Analysis</h3>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 24 }}>
                  <span style={{ fontSize: 48, fontWeight: 800, color: analysis.matchScore >= 80 ? 'var(--success)' : 'var(--warning)' }}>{analysis.matchScore}%</span>
                  <span style={{ fontSize: 16, color: 'var(--text-muted)' }}>Match Score</span>
                </div>
                <div style={{ marginBottom: 20 }}><h4 style={{ color: 'var(--success)', marginBottom: 8, fontSize: 14 }}>Strengths</h4><ul style={{ paddingLeft: 20, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>{analysis.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
                <div style={{ marginBottom: 20 }}><h4 style={{ color: 'var(--error)', marginBottom: 8, fontSize: 14 }}>Missing Skills</h4><ul style={{ paddingLeft: 20, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>{analysis.gaps.map((g, i) => <li key={i}>{g}</li>)}</ul></div>
                <div><h4 style={{ color: 'var(--warning)', marginBottom: 8, fontSize: 14 }}>Advice</h4><ul style={{ paddingLeft: 20, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>{analysis.tips.map((t, i) => <li key={i}>{t}</li>)}</ul></div>
              </div>
            )}
          </div>
        </div>
      )}

      <footer className="footer" style={{ marginTop: 40 }}><p className="footer-text">JobSpy - Multi-Source Job Search</p></footer>
    </main>
  );
}
