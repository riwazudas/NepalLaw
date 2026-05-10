"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, LayoutDashboard, ShieldAlert, Search, RefreshCcw, 
  Play, CheckCircle2, AlertCircle, HelpCircle, Database, FileCode,
  Loader2, Wand2, Terminal, ChevronRight, Activity, Sparkles, BookOpen
} from 'lucide-react';

interface AuditIssue {
  id: string;
  actId: string;
  actName: string;
  category: 'gap' | 'broken_link' | 'formatting' | 'mismatch';
  severity: 'high' | 'medium' | 'low';
  description: string;
  details: {
    sectionId?: string;
    language?: 'english' | 'nepali';
    sourceFile?: string;
    companionFile?: string;
    targetRef?: string;
    snippet?: string;
    missingContentFrom?: string;
  };
  status: 'pending' | 'healing' | 'healed' | 'failed';
  error?: string;
}

interface SearchResult {
  actId: string;
  sectionId: string;
  actName: string;
  year: string;
  title: string;
  content: string;
  language: string;
  score: number;
  explanation?: string;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'audit' | 'playground'>('dashboard');
  const [knowledgeBase, setKnowledgeBase] = useState<any[]>([]);
  const [issues, setIssues] = useState<AuditIssue[]>([]);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestConsole, setIngestConsole] = useState<string>('');
  
  // Healing state
  const [healingIssueId, setHealingIssueId] = useState<string | null>(null);
  const [healLogs, setHealLogs] = useState<string>('');
  const [healModalOpen, setHealModalOpen] = useState(false);
  const [isAutoHealing, setIsAutoHealing] = useState(false);
  const [autoHealProgress, setAutoHealProgress] = useState({ current: 0, total: 0 });
  const [throttleCountdown, setThrottleCountdown] = useState(0);

  // Playground search state
  const [searchQuery, setSearchQuery] = useState('');
  const [useReRanking, setUseReRanking] = useState(true);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Load initial data
  useEffect(() => {
    fetchKB();
    triggerSilentAudit();
  }, []);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [healLogs]);

  const fetchKB = async () => {
    try {
      const res = await fetch('/api/knowledge');
      const data = await res.json();
      if (Array.isArray(data)) {
        setKnowledgeBase(data);
      }
    } catch (err) {
      console.error('Failed to load KB:', err);
    }
  };

  const triggerSilentAudit = async () => {
    try {
      const res = await fetch('/api/admin/audit');
      const data = await res.json();
      if (data.success && Array.isArray(data.issues)) {
        setIssues(data.issues);
      }
    } catch (err) {
      console.error('Failed silent audit:', err);
    }
  };

  const runFullAudit = async () => {
    setIsAuditing(true);
    try {
      const res = await fetch('/api/admin/audit');
      const data = await res.json();
      if (data.success && Array.isArray(data.issues)) {
        setIssues(data.issues);
      } else {
        alert('Audit failed: ' + (data.error || 'Unknown error'));
      }
    } catch (err: any) {
      alert('Audit API failed: ' + err.message);
    } finally {
      setIsAuditing(false);
    }
  };

  const runReIngest = async () => {
    setIsIngesting(true);
    setIngestConsole('Scanning d:/Downloads/NepalLaw/data/laws/...\n');
    try {
      const res = await fetch('/api/admin/ingest', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setIngestConsole(prev => prev + `[Success] Found ${data.totalFiles} files.\nParsed ${data.totalActs} unique acts.\nCompiled ${data.totalSections} sections.\nSaved database to public/knowledge_base.json.\n`);
        fetchKB();
        triggerSilentAudit();
      } else {
        setIngestConsole(prev => prev + `[Error] ${data.error || 'Failed to ingest.'}\n`);
      }
    } catch (err: any) {
      setIngestConsole(prev => prev + `[Connection Error] ${err.message}\n`);
    } finally {
      setIsIngesting(false);
    }
  };

  const handleHeal = async (issue: AuditIssue) => {
    setHealingIssueId(issue.id);
    setHealLogs(`Initializing Self-Healing Agent for issue: ${issue.id}\nTargeting Act: ${issue.actName}\nCategory: ${issue.category.toUpperCase()}\n`);
    setHealModalOpen(true);

    try {
      const res = await fetch('/api/admin/heal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue })
      });
      const data = await res.json();
      
      if (data.log) {
        setHealLogs(prev => prev + '\n' + data.log);
      }

      if (data.success) {
        setHealLogs(prev => prev + `\n[SUCCESS] Issue healed completely! Relational models synced.\n`);
        // Set issue as healed locally
        setIssues(prev => prev.map(i => i.id === issue.id ? { ...i, status: 'healed' } : i));
        fetchKB();
      } else {
        setHealLogs(prev => prev + `\n[FAILED] Healing could not be completed automatically: ${data.error || 'Unknown error'}\n`);
        setIssues(prev => prev.map(i => i.id === issue.id ? { ...i, status: 'failed' } : i));
      }
    } catch (err: any) {
      setHealLogs(prev => prev + `\n[SYSTEM ERROR] API invocation failed: ${err.message}\n`);
      setIssues(prev => prev.map(i => i.id === issue.id ? { ...i, status: 'failed' } : i));
    } finally {
      setHealingIssueId(null);
    }
  };

  const handleHealAll = async () => {
    const pendingIssues = issues.filter(i => i.status === 'pending' || i.status === 'failed');
    if (pendingIssues.length === 0) {
      alert('All diagnosed issues are already healed!');
      return;
    }

    setIsAutoHealing(true);
    setAutoHealProgress({ current: 0, total: pendingIssues.length });
    setHealLogs(`[Auto-Healer] Initializing Automatic Self-Healing Session...\n`);
    setHealLogs(prev => prev + `[Auto-Healer] Found ${pendingIssues.length} pending issues to heal.\n`);
    setHealLogs(prev => prev + `[Auto-Healer] Safety rate-limiting throttling active: a 5-second wait countdown will be enforced between operations to protect Gemini API limits.\n\n`);
    setHealModalOpen(true);

    for (let i = 0; i < pendingIssues.length; i++) {
      const issue = pendingIssues[i];
      setAutoHealProgress({ current: i + 1, total: pendingIssues.length });
      setHealingIssueId(issue.id);
      setHealLogs(prev => prev + `\n--------------------------------------------------------------------------------\n`);
      setHealLogs(prev => prev + `[Auto-Healer] Starting task ${i + 1}/${pendingIssues.length}: ${issue.description}\n`);
      
      // Update the local status to healing
      setIssues(prev => prev.map(item => item.id === issue.id ? { ...item, status: 'healing' } : item));

      try {
        const res = await fetch('/api/admin/heal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ issue })
        });
        const data = await res.json();
        
        if (data.log) {
          setHealLogs(prev => prev + '\n' + data.log);
        }

        if (data.success) {
          setHealLogs(prev => prev + `\n[SUCCESS] Issue ${issue.id} has been repaired successfully!\n`);
          setIssues(prev => prev.map(item => item.id === issue.id ? { ...item, status: 'healed' } : item));
          fetchKB();
        } else {
          setHealLogs(prev => prev + `\n[FAILED] Issue ${issue.id} healing failed: ${data.error || 'Unknown error'}\n`);
          setIssues(prev => prev.map(item => item.id === issue.id ? { ...item, status: 'failed' } : item));
        }
      } catch (err: any) {
        setHealLogs(prev => prev + `\n[SYSTEM ERROR] API invocation failed: ${err.message}\n`);
        setIssues(prev => prev.map(item => item.id === issue.id ? { ...item, status: 'failed' } : item));
      } finally {
        setHealingIssueId(null);
      }

      // Enforce rate limiting safety delay if there are more issues remaining in the batch
      if (i < pendingIssues.length - 1) {
        setHealLogs(prev => prev + `\n[Auto-Healer] Cooling down for 5 seconds to protect API rate limits...\n`);
        for (let secondsLeft = 5; secondsLeft > 0; secondsLeft--) {
          setThrottleCountdown(secondsLeft);
          setHealLogs(prev => prev + `[Auto-Healer] Throttle pause: ${secondsLeft}s remaining...\n`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        setThrottleCountdown(0);
        setHealLogs(prev => prev + `[Auto-Healer] Throttle pause completed. Resuming next operation...\n`);
      }
    }

    setHealLogs(prev => prev + `\n================================================================================\n`);
    setHealLogs(prev => prev + `🎉 [Auto-Healer] AUTOMATIC BATCH HEALING COMPLETED SUCCESSFULLY!\n`);
    setIsAutoHealing(false);
  };

  const handleSearchPlayground = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || isSearching) return;

    setIsSearching(true);
    setSearchResults([]);
    try {
      const res = await fetch('/api/admin/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, useReRanking })
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.results)) {
        setSearchResults(data.results);
      } else {
        alert('Search failed: ' + (data.error || 'Unknown error'));
      }
    } catch (err: any) {
      alert('Search API failure: ' + err.message);
    } finally {
      setIsSearching(false);
    }
  };

  // Derived Stats
  const stats = useMemo(() => {
    let totalSections = 0;
    let bilingualSections = 0;

    for (const law of knowledgeBase) {
      for (const section of law.sections) {
        totalSections++;
        if (section.english && section.nepali) {
          bilingualSections++;
        }
      }
    }

    const coverage = totalSections > 0 ? (bilingualSections / totalSections) * 100 : 0;
    
    const highCount = issues.filter(i => i.severity === 'high' && i.status !== 'healed').length;
    const medCount = issues.filter(i => i.severity === 'medium' && i.status !== 'healed').length;
    const lowCount = issues.filter(i => i.severity === 'low' && i.status !== 'healed').length;

    const healthScore = Math.max(0, Math.min(100, Math.round(100 - (highCount * 6) - (medCount * 2.5) - (lowCount * 0.8))));

    return {
      totalActs: knowledgeBase.length,
      totalSections,
      bilingualSections,
      coverage: Math.round(coverage * 10) / 10,
      healthScore,
      highIssues: highCount,
      mediumIssues: medCount,
      lowIssues: lowCount,
      totalIssues: highCount + medCount + lowCount
    };
  }, [knowledgeBase, issues]);

  return (
    <main className="admin-page" suppressHydrationWarning>
      <header className="header" style={{ padding: '0.75rem 2rem' }}>
        <div className="logo" style={{ cursor: 'pointer' }}>
          <Sparkles size={22} className="pulse-icon" />
          <span>Knowledge Brain Control Panel</span>
        </div>
        <div className="header-actions">
          <Link href="/" className="reset-btn" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ArrowLeft size={16} />
            <span>Back to Assistant</span>
          </Link>
        </div>
      </header>

      <div className="admin-body">
        {/* Sidebar Tabs */}
        <aside className="admin-sidebar">
          <div className="sidebar-title">NAVIGATION</div>
          <button 
            className={`sidebar-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard & Ingest</span>
          </button>
          <button 
            className={`sidebar-tab ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            <ShieldAlert size={18} />
            <span>Audit & Self-Heal</span>
            {stats.totalIssues > 0 && <span className="error-badge-count">{stats.totalIssues}</span>}
          </button>
          <button 
            className={`sidebar-tab ${activeTab === 'playground' ? 'active' : ''}`}
            onClick={() => setActiveTab('playground')}
          >
            <Search size={18} />
            <span>Search Playground</span>
          </button>
        </aside>

        {/* Content Panel */}
        <section className="admin-content">
          {activeTab === 'dashboard' && (
            <div className="admin-tab-content">
              <h2 className="section-title">Knowledge Base Health & Ingest</h2>
              
              {/* Health Score and Metrics Grid */}
              <div className="stats-grid">
                <div className="stat-card health-score-card">
                  <div className="stat-card-title">Brain Health Index</div>
                  <div className="health-score-ring">
                    <span className={`health-score-num ${stats.healthScore > 85 ? 'good' : stats.healthScore > 65 ? 'warning' : 'danger'}`}>
                      {stats.healthScore}%
                    </span>
                  </div>
                  <p className="health-score-desc">
                    {stats.healthScore > 85 ? 'Knowledge base structural alignment is superb.' : stats.healthScore > 65 ? 'Minor translation gaps or broken links detected.' : 'Immediate self-healing recommended to repair inconsistencies.'}
                  </p>
                </div>

                <div className="stat-card-group">
                  <div className="mini-stat-card">
                    <div className="mini-stat-icon act"><BookOpen size={20} /></div>
                    <div>
                      <div className="mini-stat-num">{stats.totalActs}</div>
                      <div className="mini-stat-label">Total Ingested Acts</div>
                    </div>
                  </div>
                  
                  <div className="mini-stat-card">
                    <div className="mini-stat-icon section"><Database size={20} /></div>
                    <div>
                      <div className="mini-stat-num">{stats.totalSections}</div>
                      <div className="mini-stat-label">Total Parsed Sections</div>
                    </div>
                  </div>

                  <div className="mini-stat-card">
                    <div className="mini-stat-icon coverage"><FileCode size={20} /></div>
                    <div>
                      <div className="mini-stat-num">{stats.coverage}%</div>
                      <div className="mini-stat-label">Bilingual Coverage</div>
                    </div>
                  </div>
                </div>

                <div className="stat-card issues-status-card">
                  <div className="stat-card-title">Outstanding Issues</div>
                  <div className="issues-stat-row">
                    <span className="issue-label"><AlertCircle size={14} className="text-red" /> High Severity (Gaps)</span>
                    <span className="issue-val font-bold text-red">{stats.highIssues}</span>
                  </div>
                  <div className="issues-stat-row">
                    <span className="issue-label"><HelpCircle size={14} className="text-orange" /> Medium Severity (Refs)</span>
                    <span className="issue-val font-bold text-orange">{stats.mediumIssues}</span>
                  </div>
                  <div className="issues-stat-row">
                    <span className="issue-label"><Activity size={14} className="text-blue" /> Low Severity (Formatting)</span>
                    <span className="issue-val font-bold text-blue">{stats.lowIssues}</span>
                  </div>
                </div>
              </div>

              {/* Dynamic Ingestion Card */}
              <div className="ingest-box-card">
                <div className="ingest-card-header">
                  <div>
                    <h3>Dynamic Ingestion Agent</h3>
                    <p>Trigger automated schema validation, structure parsing, and bilingual assembly of raw markdown law acts in <code>../data/laws</code>.</p>
                  </div>
                  <button 
                    className="view-toggle-btn-small" 
                    onClick={runReIngest}
                    disabled={isIngesting}
                    style={{ background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    {isIngesting ? <Loader2 className="spin" size={16} /> : <RefreshCcw size={16} />}
                    <span>{isIngesting ? 'Ingesting...' : 'Trigger Ingestion'}</span>
                  </button>
                </div>
                
                <div className="terminal-console">
                  <div className="terminal-header">
                    <Terminal size={14} />
                    <span>INGESTION AGENT TERMINAL LOGGER</span>
                  </div>
                  <pre className="terminal-body">
                    {ingestConsole || 'No run logs. Click "Trigger Ingestion" above to compile raw legislative markdown assets.'}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="admin-tab-content">
              <div className="section-header-row">
                <div>
                  <h2 className="section-title" style={{ margin: 0 }}>Legislative Alignment Audit Center</h2>
                  <p className="section-subtitle">Auto-audits document translation completeness and structural cross-reference integrity using AI models.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <button 
                    className="view-toggle-btn-small" 
                    onClick={runFullAudit}
                    disabled={isAuditing || isAutoHealing}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    {isAuditing ? <Loader2 className="spin" size={16} /> : <ShieldAlert size={16} />}
                    <span>{isAuditing ? 'Auditing...' : 'Run Diagnostics Audit'}</span>
                  </button>

                  {issues.some(i => i.status === 'pending' || i.status === 'failed') && (
                    <button 
                      className="view-toggle-btn-small" 
                      onClick={handleHealAll}
                      disabled={isAuditing || isAutoHealing}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.5rem', 
                        background: '#10b981', 
                        color: 'white',
                        border: 'none',
                        boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)'
                      }}
                    >
                      {isAutoHealing ? <Loader2 className="spin" size={16} /> : <Wand2 size={16} />}
                      <span>{isAutoHealing ? 'Auto-Healing...' : 'Heal All Issues'}</span>
                    </button>
                  )}
                </div>
              </div>

              {issues.length === 0 ? (
                <div className="empty-state-box">
                  <CheckCircle2 size={48} className="text-green" />
                  <h3>Knowledge Base is Perfectly Aligned!</h3>
                  <p>Our audit reports no structural gaps, formatting anomalies, or broken links. The Knowledge Brain is healthy.</p>
                </div>
              ) : (
                <div className="issues-list">
                  {issues.map((issue) => (
                    <div key={issue.id} className={`issue-row-card severity-${issue.severity}`}>
                      <div className="issue-row-left">
                        <div className={`severity-badge ${issue.severity}`}>
                          {issue.severity.toUpperCase()}
                        </div>
                        <div className="issue-info">
                          <h4>{issue.description}</h4>
                          <div className="issue-meta">
                            <span>Act: <strong>{issue.actName}</strong></span>
                            {issue.details.sectionId && <span>Section: <code>{issue.details.sectionId}</code></span>}
                            <span>Source File: <code>{issue.details.sourceFile}</code></span>
                          </div>
                          {issue.details.snippet && (
                            <div className="issue-snippet">
                              <strong>Snippet Context:</strong> "{issue.details.snippet}"
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="issue-row-right">
                        {issue.status === 'healed' ? (
                          <div className="healed-badge-row">
                            <CheckCircle2 size={16} className="text-green" />
                            <span>HEALED</span>
                          </div>
                        ) : issue.status === 'healing' || healingIssueId === issue.id ? (
                          <div className="healing-badge-row">
                            <Loader2 size={16} className="spin text-blue" />
                            <span>Healing...</span>
                          </div>
                        ) : (
                          <button 
                            className="heal-action-btn"
                            onClick={() => handleHeal(issue)}
                            disabled={!!healingIssueId}
                          >
                            <Wand2 size={14} />
                            <span>Self-Heal</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'playground' && (
            <div className="admin-tab-content">
              <h2 className="section-title">Retrieval & Context Verification</h2>
              <p className="section-subtitle">Test and verify the Hybrid BM25/TF-IDF scoring + bilingual query expansion + Gemini context re-ranking pipeline.</p>

              <form onSubmit={handleSearchPlayground} className="playground-search-form">
                <div className="search-input-wrapper">
                  <Search size={20} className="search-icon" />
                  <input 
                    type="text" 
                    placeholder="Enter a legal test query (e.g. 'How is arbitrator appointed?', 'मध्यस्थको नियुक्ति कसरि हुन्छ?')"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    disabled={isSearching}
                    suppressHydrationWarning={true}
                  />
                  <button type="submit" disabled={!searchQuery.trim() || isSearching}>
                    {isSearching ? <Loader2 className="spin" size={18} /> : 'Retrieve Context'}
                  </button>
                </div>
                
                <div className="playground-search-options">
                  <label className="checkbox-label">
                    <input 
                      type="checkbox" 
                      checked={useReRanking}
                      onChange={(e) => setUseReRanking(e.target.checked)}
                      suppressHydrationWarning={true}
                    />
                    <Sparkles size={16} className="text-orange" />
                    <span>Enable Context-Aware LLM Re-ranking (Gemini)</span>
                  </label>
                </div>
              </form>

              {isSearching ? (
                <div className="searching-skeleton">
                  <Loader2 className="spin" size={32} />
                  <p>Searching index, expanding query, and calculating cosine similarities...</p>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="playground-results">
                  <h3>Retrieved {searchResults.length} Relevant Blocks</h3>
                  
                  <div className="results-list">
                    {searchResults.map((res, index) => (
                      <div key={index} className="retrieved-doc-card">
                        <div className="retrieved-doc-header">
                          <div className="retrieved-doc-title-group">
                            <span className="retrieved-doc-index">#{index + 1}</span>
                            <h4>{res.title}</h4>
                            <span className="retrieved-doc-act">{res.actName} ({res.year})</span>
                          </div>
                          <div className="retrieved-doc-metrics">
                            <span className="doc-lang-badge">{res.language.toUpperCase()}</span>
                            <span className="doc-score-badge">Match: {res.score}%</span>
                          </div>
                        </div>

                        {res.explanation && (
                          <div className="re-ranking-explanation-box">
                            <Sparkles size={14} className="text-orange" />
                            <p><strong>Gemini Relevance Reason:</strong> {res.explanation}</p>
                          </div>
                        )}

                        <div className="retrieved-doc-content">
                          <p>{res.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : searchQuery && (
                <div className="empty-state-box">
                  <AlertCircle size={48} className="text-muted" />
                  <h3>No matches found in legislative index</h3>
                  <p>Try matching terms in alternative formats or make sure the query language matches defined bilingual laws.</p>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Healing Console Modal */}
      {healModalOpen && (
        <div className="modal-overlay" onClick={() => !healingIssueId && !isAutoHealing && setHealModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '750px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header-sticky" style={{ padding: '1.25rem 2rem' }}>
              <div className="modal-header-top" style={{ margin: 0 }}>
                <div className="title-area">
                  <span className="subtitle">Agent Diagnostics Console</span>
                  <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span>AI Self-Healing Pipeline</span>
                    {isAutoHealing && (
                      <span className="view-badge" style={{ background: '#d1fae5', color: '#065f46', fontSize: '0.7rem', padding: '0.2rem 0.6rem' }}>
                        Batch Progress {autoHealProgress.current} / {autoHealProgress.total}
                      </span>
                    )}
                    {throttleCountdown > 0 && (
                      <span className="view-badge" style={{ background: '#fef3c7', color: '#92400e', fontSize: '0.7rem', padding: '0.2rem 0.6rem' }}>
                        Throttling Safety Pause: {throttleCountdown}s
                      </span>
                    )}
                  </h2>
                </div>
                {!healingIssueId && !isAutoHealing && (
                  <button className="close-btn" onClick={() => setHealModalOpen(false)}>&times;</button>
                )}
              </div>
            </div>
            
            <div className="modal-body" style={{ background: '#0a0f1d', color: '#10b981', fontFamily: 'monospace', padding: '1.5rem', maxHeight: '450px' }}>
              <pre className="terminal-output" style={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem', margin: 0 }}>
                {healLogs}
                <div ref={logsEndRef} />
              </pre>
            </div>

            <div className="modal-footer" style={{ padding: '1rem 2rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', background: 'var(--background)' }}>
              <button 
                className="view-toggle-btn-small" 
                onClick={() => setHealModalOpen(false)}
                disabled={!!healingIssueId || isAutoHealing}
                style={{ background: 'var(--muted)', color: 'var(--foreground)' }}
              >
                Close Agent Log
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
