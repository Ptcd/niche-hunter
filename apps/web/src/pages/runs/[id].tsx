import { GetServerSideProps } from 'next';
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { prisma } from '@niche-hunter/db';
import { useRouter } from 'next/router';

interface Keyword {
  id: string;
  keyword: string;
  volume: number;
  difficulty: number | null;
  intent: string | null;
  priority: number | null;
  cpc: number | null;
}

interface Scan {
  id: string;
  city: string;
  state: string;
  zip: string | null;
  demandScore: number;
  difficulty: number;
  opportunity: number;
  profitEst: number | null;
  classification: string | null;
  keywords: string | null;
  timeToRank: string | null;
  competitionStrength: number | null;
  competitorJson: any;
  relatedKeywords: string | null;
  keywordMetrics?: Keyword[];
}

interface Run {
  id: string;
  niche: string;
  payout: number;
  createdAt: string;
  status: string;
  notes: string | null;
}

interface Props {
  run: Run;
  scans: Scan[];
}

export default function RunDetail({ run, scans }: Props) {
  const router = useRouter();
  const [filterState, setFilterState] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [minOpportunity, setMinOpportunity] = useState('');
  const [stopping, setStopping] = useState(false);
  const [stopError, setStopError] = useState('');
  const [logs, setLogs] = useState('');
  const [logsLoading, setLogsLoading] = useState(false);
  const [logViewerOpen, setLogViewerOpen] = useState(false); // Start closed to avoid hydration issues
  const [isClient, setIsClient] = useState(false); // Track if we're on client side
  const logViewerRef = useRef<HTMLDivElement>(null);
  
  // Set client-side flag and open logs if running
  useEffect(() => {
    setIsClient(true);
    if (run.status === 'running') {
      setLogViewerOpen(true);
    }
  }, [run.status]);
  
  // Fetch logs when log viewer is open (only on client side)
  useEffect(() => {
    if (logViewerOpen && isClient) {
      const fetchLogs = async () => {
        try {
          setLogsLoading(true);
          const response = await fetch(`/api/runs/${run.id}/logs`);
          const data = await response.json();
          if (data.logs) {
            setLogs(data.logs);
            // Auto-scroll to bottom only if run is still running
            if (run.status === 'running') {
              setTimeout(() => {
                if (logViewerRef.current) {
                  logViewerRef.current.scrollTop = logViewerRef.current.scrollHeight;
                }
              }, 100);
            }
          }
        } catch (error) {
          console.error('Error fetching logs:', error);
        } finally {
          setLogsLoading(false);
        }
      };
      
      // Fetch immediately
      fetchLogs();
      
      // Poll every 2 seconds only if run is still running
      if (run.status === 'running') {
        const interval = setInterval(fetchLogs, 2000);
        return () => clearInterval(interval);
      }
    }
  }, [run.status, run.id, logViewerOpen, isClient]);
  
  // Auto-refresh page every 3 seconds if analysis is running (for scan updates)
  useEffect(() => {
    if (run.status === 'running') {
      const interval = setInterval(() => {
        // Only refresh if we're still on the same page and run is still running
        const currentPath = router.asPath;
        router.replace(currentPath).catch(() => {
          // Ignore navigation errors (e.g., navigating to same URL)
        });
      }, 3000); // Refresh every 3 seconds
      
      return () => clearInterval(interval);
    }
  }, [run.status, router]);
  
  const copyLogs = () => {
    // Only run on client side
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }
    
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      // Fallback for browsers without clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = logs;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        alert('Logs copied to clipboard!');
      } catch (err) {
        console.error('Failed to copy logs:', err);
        alert('Failed to copy logs. Please select and copy manually.');
      }
      document.body.removeChild(textArea);
      return;
    }
    
    navigator.clipboard.writeText(logs).then(() => {
      alert('Logs copied to clipboard!');
    }).catch((err) => {
      console.error('Failed to copy logs:', err);
      alert('Failed to copy logs. Please select and copy manually.');
    });
  };

  const filtered = scans.filter((scan) => {
    if (filterState && scan.state !== filterState) return false;
    if (filterDifficulty && scan.classification !== filterDifficulty) return false;
    if (minOpportunity && scan.opportunity < parseFloat(minOpportunity)) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => b.opportunity - a.opportunity);
  const top3 = sorted.slice(0, 3);

  const states = Array.from(new Set(scans.map((s) => s.state))).sort();
  const difficulties = Array.from(
    new Set(scans.map((s) => s.classification).filter((d): d is string => !!d))
  ).sort();

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <Link href="/">← Back to Runs</Link>
      </div>

      <h1>Run: {run.niche}</h1>
      <div style={{ marginBottom: '2rem', color: '#666' }}>
        <p>Payout: ${run.payout}</p>
        <p>Status: {run.status}</p>
        <p>Created: {new Date(run.createdAt).toLocaleString()}</p>
        {run.notes && (
          <div style={{ 
            marginTop: '1rem', 
            padding: '0.75rem', 
            backgroundColor: '#e7f3ff', 
            border: '1px solid #b3d9ff',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '0.9rem'
          }}>
            <strong>Progress:</strong> {run.notes}
          </div>
        )}
      </div>

      {(run.status === 'running' || run.status === 'error') && (
        <div style={{ 
          marginBottom: '2rem', 
          padding: '1.5rem', 
          backgroundColor: '#d1ecf1', 
          border: '2px solid #bee5eb',
          borderRadius: '8px'
        }}>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: run.status === 'error' && run.notes ? '1rem' : '0' }}>
              <p style={{ color: '#0c5460', margin: 0, fontSize: '1.1rem', fontWeight: 'bold' }}>
                {run.status === 'error' ? '❌ Analysis encountered an error' : '⏳ Analysis in progress...'}
              </p>
              <button
                onClick={async () => {
                if (!confirm('Stop the analysis immediately? This cannot be undone.')) {
                  return;
                }
                setStopping(true);
                setStopError('');
                try {
                  const response = await fetch(`/api/runs/${run.id}/stop`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                  });
                  
                  let data;
                  try {
                    data = await response.json();
                  } catch (e) {
                    throw new Error(`Server error: ${response.status} ${response.statusText}`);
                  }
                  
                  if (!response.ok) {
                    // Show the actual error from the server
                    const errorMsg = data.error || `Failed to stop analysis (${response.status})`;
                    console.error('Stop failed:', errorMsg);
                    console.error('Response status:', response.status);
                    console.error('Response data:', data);
                    console.error('Page shows run status as:', run.status);
                    // Still show error to user
                    setStopError(errorMsg);
                    setStopping(false);
                    return; // Don't throw, just show error
                  }
                  // Success - reload page to show updated status
                  console.log('Stop successful:', data.message);
                  window.location.reload();
                } catch (err: any) {
                  console.error('Stop error:', err);
                  setStopError(err.message || 'Failed to stop analysis');
                  setStopping(false);
                }
              }}
              disabled={stopping}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: stopping ? '#ccc' : '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: stopping ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
                fontWeight: 'bold'
              }}
            >
              {stopping ? 'Stopping...' : '🛑 STOP ANALYSIS'}
            </button>
            </div>
            {run.status === 'error' && run.notes && (
              <div style={{ 
                padding: '0.75rem', 
                backgroundColor: '#f8d7da', 
                border: '1px solid #f5c6cb',
                borderRadius: '4px',
                color: '#721c24',
                marginBottom: '1rem',
                fontFamily: 'monospace',
                fontSize: '0.9rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                <strong>Error details:</strong><br />
                {run.notes}
              </div>
            )}
          </div>
          {stopError && (
            <div style={{ 
              padding: '0.75rem', 
              backgroundColor: '#f8d7da', 
              border: '1px solid #f5c6cb',
              borderRadius: '4px',
              color: '#721c24',
              marginTop: '0.5rem'
            }}>
              {stopError}
            </div>
          )}
          <p style={{ color: '#0c5460', margin: 0, fontSize: '0.9rem' }}>
            Using Keywords Everywhere extension to fetch search volumes. Chrome tabs may open for each keyword search.
          </p>
          
          {/* Log Viewer - only render on client side to avoid hydration errors */}
          {isClient && (
            <div style={{ marginTop: '1.5rem' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '0.5rem'
              }}>
                <button
                  onClick={() => setLogViewerOpen(!logViewerOpen)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: 'bold'
                  }}
                >
                  {logViewerOpen ? '▼ Hide Logs' : '▶ Show Logs'}
                </button>
                {logViewerOpen && logs && (
                  <button
                    onClick={copyLogs}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: 'bold'
                    }}
                  >
                    📋 Copy Logs
                  </button>
                )}
              </div>
              
              {logViewerOpen && (
                <div style={{
                  backgroundColor: '#1e1e1e',
                  border: '2px solid #444',
                  borderRadius: '8px',
                  padding: '1rem',
                  maxHeight: '500px',
                  overflow: 'auto',
                  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                  fontSize: '0.85rem',
                  lineHeight: '1.4'
                }}
                ref={logViewerRef}
                >
                  {logsLoading && !logs && (
                    <div style={{ color: '#888', fontStyle: 'italic' }}>
                      Loading logs...
                    </div>
                  )}
                  {!logsLoading && !logs && (
                    <div style={{ color: '#888', fontStyle: 'italic' }}>
                      No logs available yet. Logs will appear here as the analysis runs.
                    </div>
                  )}
                  {logs && (
                    <pre style={{ 
                      margin: 0, 
                      color: '#d4d4d4',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }}>
                      {logs}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {run.status === 'cancelled' && (
        <div style={{ 
          marginBottom: '2rem', 
          padding: '1rem', 
          backgroundColor: '#f8d7da', 
          border: '1px solid #f5c6cb',
          borderRadius: '8px'
        }}>
          <p style={{ color: '#721c24', margin: 0, fontWeight: 'bold' }}>
            ⛔ Analysis was stopped
          </p>
          <p style={{ color: '#721c24', margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
            The analysis was cancelled. Results shown are only for locations processed before cancellation.
          </p>
          
          {/* Log Viewer for cancelled runs - only render on client side */}
          {isClient && (
            <div style={{ marginTop: '1.5rem' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '0.5rem'
              }}>
                <button
                  onClick={() => setLogViewerOpen(!logViewerOpen)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: 'bold'
                  }}
                >
                  {logViewerOpen ? '▼ Hide Logs' : '▶ Show Logs'}
                </button>
                {logViewerOpen && logs && (
                  <button
                    onClick={copyLogs}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: 'bold'
                    }}
                  >
                    📋 Copy Logs
                  </button>
                )}
              </div>
              
              {logViewerOpen && (
                <div style={{
                  backgroundColor: '#1e1e1e',
                  border: '2px solid #444',
                  borderRadius: '8px',
                  padding: '1rem',
                  maxHeight: '500px',
                  overflow: 'auto',
                  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                  fontSize: '0.85rem',
                  lineHeight: '1.4'
                }}
                ref={logViewerRef}
                >
                  {logsLoading && !logs && (
                    <div style={{ color: '#888', fontStyle: 'italic' }}>
                      Loading logs...
                    </div>
                  )}
                  {!logsLoading && !logs && (
                    <div style={{ color: '#888', fontStyle: 'italic' }}>
                      No logs available.
                    </div>
                  )}
                  {logs && (
                    <pre style={{ 
                      margin: 0, 
                      color: '#d4d4d4',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }}>
                      {logs}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <label>
            Filter by State:{' '}
            <select
              value={filterState}
              onChange={(e) => setFilterState(e.target.value)}
              style={{ padding: '0.25rem' }}
            >
              <option value="">All</option>
              {states.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <label>
            Filter by Difficulty:{' '}
            <select
              value={filterDifficulty}
              onChange={(e) => setFilterDifficulty(e.target.value)}
              style={{ padding: '0.25rem' }}
            >
              <option value="">All</option>
              {difficulties.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <label>
            Min Opportunity:{' '}
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={minOpportunity}
              onChange={(e) => setMinOpportunity(e.target.value)}
              style={{ padding: '0.25rem', width: '100px' }}
            />
          </label>
        </div>
      </div>

      {top3.length > 0 && (
        <div style={{ marginBottom: '3rem', padding: '1rem', backgroundColor: '#f0f0f0', borderRadius: '8px' }}>
          <h2>Top 3 Opportunities</h2>
          {top3.map((scan, idx) => (
            <div key={scan.id} style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'white', borderRadius: '4px' }}>
              <h3>
                {idx + 1}. {scan.city}, {scan.state} {scan.zip && `(${scan.zip})`}
              </h3>
              <p>Opportunity Score: {scan.opportunity.toFixed(3)}</p>
              <p>Demand: {scan.demandScore.toFixed(3)} | Difficulty: {scan.difficulty.toFixed(3)} ({scan.classification || 'N/A'})</p>
              <p>Estimated Monthly Profit: ${scan.profitEst?.toFixed(2) || 'N/A'}</p>
              {scan.timeToRank && (
                <p>⏱️ Time to Rank: <strong>{scan.timeToRank}</strong></p>
              )}
              {scan.competitionStrength !== null && (
                <p>💪 Competition Strength: <strong>{(scan.competitionStrength).toFixed(1)}/10</strong></p>
              )}
              {scan.keywordMetrics && scan.keywordMetrics.length > 0 && (() => {
                // Calculate aggregate lead estimates
                const totalVolume = scan.keywordMetrics.slice(0, 5).reduce((sum, kw) => sum + kw.volume, 0);
                // Conservative: rank #5 (4% CTR, 3% conversion)
                const conservativeLeads = Math.round(totalVolume * 0.04 * 0.03);
                // Realistic: rank #3 (10% CTR, 3% conversion)
                const realisticLeads = Math.round(totalVolume * 0.10 * 0.03);
                // Optimistic: rank #1 (30% CTR, 3% conversion)
                const optimisticLeads = Math.round(totalVolume * 0.30 * 0.03);
                return (
                  <div style={{ marginTop: '0.5rem' }}>
                    <div style={{ padding: '0.75rem', backgroundColor: '#e7f3ff', borderRadius: '4px', marginBottom: '0.5rem' }}>
                      <strong>Aggregate Monthly Leads (Top 5 Keywords):</strong>
                      <div style={{ marginTop: '0.25rem', fontSize: '0.9rem' }}>
                        Conservative (Rank #5): <strong>{conservativeLeads}</strong> leads (${(conservativeLeads * run.payout).toFixed(2)})
                        <br />
                        Realistic (Rank #3): <strong>{realisticLeads}</strong> leads (${(realisticLeads * run.payout).toFixed(2)})
                        <br />
                        Optimistic (Rank #1): <strong>{optimisticLeads}</strong> leads (${(optimisticLeads * run.payout).toFixed(2)})
                      </div>
                    </div>
                    <div style={{ padding: '0.75rem', backgroundColor: '#f0f9ff', borderRadius: '4px' }}>
                      <strong>Individual Keyword Lead Estimates:</strong>
                      <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                        {scan.keywordMetrics.slice(0, 5).map((kw) => {
                          // Calculate per-keyword estimates
                          const kwConservative = Math.round(kw.volume * 0.04 * 0.03);
                          const kwRealistic = Math.round(kw.volume * 0.10 * 0.03);
                          const kwOptimistic = Math.round(kw.volume * 0.30 * 0.03);
                          return (
                            <div key={kw.id} style={{ marginBottom: '0.5rem', padding: '0.5rem', backgroundColor: 'white', borderRadius: '3px' }}>
                              <strong>{kw.keyword}</strong> ({kw.volume.toLocaleString()} searches/mo)
                              {kw.cpc && <span style={{ marginLeft: '0.5rem', color: '#666' }}>• CPC: ${kw.cpc.toFixed(2)}</span>}
                              <div style={{ marginTop: '0.25rem', fontSize: '0.8rem', color: '#555' }}>
                                Leads: {kwConservative} (conservative) / {kwRealistic} (realistic) / {kwOptimistic} (optimistic)
                                <br />
                                Value: ${(kwConservative * run.payout).toFixed(2)} / ${(kwRealistic * run.payout).toFixed(2)} / ${(kwOptimistic * run.payout).toFixed(2)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}
              <p>Top Keywords: {scan.keywords || 'N/A'}</p>
              {scan.competitorJson && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#fff3cd', borderRadius: '4px' }}>
                  <strong>Competitor Breakdown:</strong>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                    Total Competitors: {scan.competitorJson.total || 0}
                    <br />
                    Aggregators: {scan.competitorJson.aggregators || 0} | Directories: {scan.competitorJson.directories || 0}
                    <br />
                    Lead Gen Sites: {scan.competitorJson.leadGen || 0} | Local Businesses: {scan.competitorJson.localBusiness || 0}
                    {scan.competitorJson.topCompetitors && scan.competitorJson.topCompetitors.length > 0 && (
                      <>
                        <br />
                        <strong style={{ marginTop: '0.5rem', display: 'block' }}>Top Competitors:</strong>
                        <ul style={{ margin: '0.25rem 0 0 0', paddingLeft: '1.5rem', fontSize: '0.85rem' }}>
                          {scan.competitorJson.topCompetitors.slice(0, 3).map((comp: any, idx: number) => (
                            <li key={idx}>
                              {comp.domain} ({comp.type}) - DA: {comp.estimatedDA || 'N/A'}, Quality: {comp.contentQuality}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                </div>
              )}
              {/* Volume Guards and SERP Fallback Badges */}
              {scan.competitorJson && (scan.competitorJson.serpFallback || scan.competitorJson.volumeGuards) && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#f8f9fa', borderRadius: '4px', border: '1px solid #dee2e6' }}>
                  <strong style={{ fontSize: '0.9rem' }}>Data Quality Indicators:</strong>
                  <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {scan.competitorJson.serpFallback && (
                      <span style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.5rem',
                        backgroundColor: '#fff3cd',
                        color: '#856404',
                        borderRadius: '3px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold'
                      }}>
                        🔄 SERP Fallback (Bing)
                      </span>
                    )}
                    {scan.competitorJson.volumeGuards?.volumesRejected && (
                      <span style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.5rem',
                        backgroundColor: '#f8d7da',
                        color: '#721c24',
                        borderRadius: '3px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold'
                      }}>
                        ⚠️ Volumes Rejected
                      </span>
                    )}
                    {scan.competitorJson.volumeGuards?.volumesDownscaled && (
                      <span style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.5rem',
                        backgroundColor: '#fff3cd',
                        color: '#856404',
                        borderRadius: '3px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold'
                      }}>
                        📉 Volumes Downscaled (avg: {scan.competitorJson.volumeGuards.avgVolume}/mo)
                      </span>
                    )}
                  </div>
                </div>
              )}
              {scan.relatedKeywords && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#d1ecf1', borderRadius: '4px' }}>
                  <strong>Related Keywords Discovered:</strong>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                    {scan.relatedKeywords.split(',').slice(0, 5).map((kw, idx) => (
                      <span key={idx} style={{ 
                        display: 'inline-block', 
                        margin: '0.25rem', 
                        padding: '0.25rem 0.5rem', 
                        backgroundColor: 'white', 
                        borderRadius: '3px',
                        fontSize: '0.8rem'
                      }}>
                        {kw.trim()}
                      </span>
                    ))}
                    {scan.relatedKeywords.split(',').length > 5 && (
                      <span style={{ fontSize: '0.8rem', color: '#666' }}>
                        {' '}+{scan.relatedKeywords.split(',').length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}
              {scan.profitEst && scan.profitEst > 0 && scan.keywordMetrics && scan.keywordMetrics.length > 0 && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
                  <strong>Top Keywords:</strong>
                  <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.5rem' }}>
                    {scan.keywordMetrics.slice(0, 5).map((kw) => (
                      <li key={kw.id} style={{ marginBottom: '0.25rem' }}>
                        <strong>{kw.keyword}</strong> - Volume: {kw.volume.toLocaleString()}
                        {kw.cpc && (
                          <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem', color: '#0066cc', fontWeight: 'bold' }}>
                            • CPC: ${kw.cpc.toFixed(2)}
                          </span>
                        )}
                        {kw.difficulty !== null && (
                          <span style={{ 
                            marginLeft: '0.5rem',
                            padding: '0.125rem 0.375rem',
                            borderRadius: '3px',
                            backgroundColor: kw.difficulty <= 30 ? '#d4edda' : kw.difficulty <= 60 ? '#fff3cd' : '#f8d7da',
                            color: kw.difficulty <= 30 ? '#155724' : kw.difficulty <= 60 ? '#856404' : '#721c24',
                            fontSize: '0.85rem'
                          }}>
                            {kw.difficulty <= 30 ? 'Easy' : kw.difficulty <= 60 ? 'Medium' : 'Hard'} ({kw.difficulty})
                          </span>
                        )}
                        {kw.intent && (
                          <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem', color: '#666' }}>
                            [{kw.intent}]
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <h2>All Results ({sorted.length})</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid #ddd', padding: '0.5rem', textAlign: 'left' }}>City</th>
            <th style={{ border: '1px solid #ddd', padding: '0.5rem', textAlign: 'left' }}>State</th>
            <th style={{ border: '1px solid #ddd', padding: '0.5rem', textAlign: 'left' }}>ZIP</th>
            <th style={{ border: '1px solid #ddd', padding: '0.5rem', textAlign: 'right' }}>Opportunity</th>
            <th style={{ border: '1px solid #ddd', padding: '0.5rem', textAlign: 'right' }}>Demand</th>
            <th style={{ border: '1px solid #ddd', padding: '0.5rem', textAlign: 'right' }}>Difficulty</th>
            <th style={{ border: '1px solid #ddd', padding: '0.5rem', textAlign: 'left' }}>Classification</th>
            <th style={{ border: '1px solid #ddd', padding: '0.5rem', textAlign: 'right' }}>Profit Est</th>
            <th style={{ border: '1px solid #ddd', padding: '0.5rem', textAlign: 'left' }}>Keywords</th>
            <th style={{ border: '1px solid #ddd', padding: '0.5rem', textAlign: 'left' }}>Top Keywords</th>
            <th style={{ border: '1px solid #ddd', padding: '0.5rem', textAlign: 'left' }}>Time to Rank</th>
            <th style={{ border: '1px solid #ddd', padding: '0.5rem', textAlign: 'left' }}>Competition</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((scan) => (
            <tr key={scan.id}>
              <td style={{ border: '1px solid #ddd', padding: '0.5rem' }}>{scan.city}</td>
              <td style={{ border: '1px solid #ddd', padding: '0.5rem' }}>{scan.state}</td>
              <td style={{ border: '1px solid #ddd', padding: '0.5rem' }}>{scan.zip || ''}</td>
              <td style={{ border: '1px solid #ddd', padding: '0.5rem', textAlign: 'right' }}>
                {scan.opportunity.toFixed(3)}
              </td>
              <td style={{ border: '1px solid #ddd', padding: '0.5rem', textAlign: 'right' }}>
                {scan.demandScore.toFixed(3)}
              </td>
              <td style={{ border: '1px solid #ddd', padding: '0.5rem', textAlign: 'right' }}>
                {scan.difficulty.toFixed(3)}
              </td>
              <td style={{ border: '1px solid #ddd', padding: '0.5rem' }}>{scan.classification || 'N/A'}</td>
              <td style={{ border: '1px solid #ddd', padding: '0.5rem', textAlign: 'right' }}>
                {scan.profitEst ? `$${scan.profitEst.toFixed(2)}` : 'N/A'}
              </td>
              <td style={{ border: '1px solid #ddd', padding: '0.5rem' }}>{scan.keywords || ''}</td>
              <td style={{ border: '1px solid #ddd', padding: '0.5rem' }}>
                {scan.profitEst && scan.profitEst > 0 && scan.keywordMetrics && scan.keywordMetrics.length > 0 ? (
                  <div style={{ fontSize: '0.9rem' }}>
                    {scan.keywordMetrics.slice(0, 3).map((kw, idx) => (
                      <div key={kw.id} style={{ marginBottom: idx < 2 ? '0.25rem' : 0 }}>
                        <strong>{kw.keyword}</strong> ({kw.volume.toLocaleString()})
                        {kw.cpc && (
                          <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#0066cc' }}>
                            • ${kw.cpc.toFixed(2)} CPC
                          </span>
                        )}
                        {kw.difficulty !== null && (
                          <span style={{ 
                            marginLeft: '0.5rem',
                            padding: '0.125rem 0.25rem',
                            borderRadius: '3px',
                            backgroundColor: kw.difficulty <= 30 ? '#d4edda' : kw.difficulty <= 60 ? '#fff3cd' : '#f8d7da',
                            color: kw.difficulty <= 30 ? '#155724' : kw.difficulty <= 60 ? '#856404' : '#721c24',
                            fontSize: '0.75rem'
                          }}>
                            {kw.difficulty <= 30 ? 'Easy' : kw.difficulty <= 60 ? 'Med' : 'Hard'}
                          </span>
                        )}
                      </div>
                    ))}
                    {scan.keywordMetrics.length > 3 && (
                      <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
                        +{scan.keywordMetrics.length - 3} more
                      </div>
                    )}
                  </div>
                ) : (
                  <span style={{ color: '#999' }}>N/A</span>
                )}
              </td>
              <td style={{ border: '1px solid #ddd', padding: '0.5rem' }}>
                {scan.timeToRank || <span style={{ color: '#999' }}>N/A</span>}
              </td>
              <td style={{ border: '1px solid #ddd', padding: '0.5rem' }}>
                {scan.competitorJson ? (
                  <div style={{ fontSize: '0.85rem' }}>
                    {scan.competitorJson.serpFailed ? (
                      <div>
                        <span style={{ color: '#dc3545', fontWeight: 'bold' }}>SERP Failed</span>
                        {scan.competitorJson.serpError && (
                          <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '0.25rem' }}>
                            {scan.competitorJson.serpError.substring(0, 50)}...
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <div>Total: {scan.competitorJson.total || 0}</div>
                        <div style={{ fontSize: '0.75rem', color: '#666' }}>
                          Agg: {scan.competitorJson.aggregators || 0} | Dir: {scan.competitorJson.directories || 0}
                        </div>
                        {scan.competitionStrength !== null && (
                          <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                            Strength: {(scan.competitionStrength).toFixed(1)}/10
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <span style={{ color: '#999' }}>N/A</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const id = context.params?.id as string;
  
  if (!id) {
    console.error('[getServerSideProps] No ID provided in params');
    return { notFound: true };
  }
  
  console.log('[getServerSideProps] ========================================');
  console.log('[getServerSideProps] Fetching run with ID:', id);
  console.log('[getServerSideProps] ========================================');

  try {
    // Retry logic for database connection issues (prepared statement errors)
    let run;
    let retries = 3;
    while (retries > 0) {
      try {
        run = await prisma.run.findUnique({
          where: { id },
        });
        break; // Success, exit retry loop
      } catch (dbError: any) {
        if (dbError.message?.includes('prepared statement') && retries > 1) {
          console.warn(`[getServerSideProps] Database connection error, retrying... (${retries - 1} retries left)`);
          retries--;
          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 100));
          // Disconnect and reconnect Prisma
          await prisma.$disconnect();
          await prisma.$connect();
          continue;
        }
        throw dbError; // Re-throw if not a prepared statement error or out of retries
      }
    }

    console.log('[getServerSideProps] Run found:', run ? 'YES' : 'NO');
    
    if (!run) {
      console.log('[getServerSideProps] Run not found in database, returning 404');
      return { notFound: true };
    }
    
    console.log('[getServerSideProps] Run details:', {
      id: run.id,
      niche: run.niche,
      status: run.status,
      createdAt: run.createdAt,
    });
    
    console.log('[getServerSideProps] Fetching scans for run:', run.id);

    let scans: any[] = [];
    try {
      // Retry logic for database connection issues
      let retries = 3;
      while (retries > 0) {
        try {
          scans = await prisma.scan.findMany({
            where: { runId: id },
            orderBy: { opportunity: 'desc' },
          });
          break; // Success, exit retry loop
        } catch (dbError: any) {
          if (dbError.message?.includes('prepared statement') && retries > 1) {
            console.warn(`[getServerSideProps] Database connection error fetching scans, retrying... (${retries - 1} retries left)`);
            retries--;
            await new Promise(resolve => setTimeout(resolve, 100));
            await prisma.$disconnect();
            await prisma.$connect();
            continue;
          }
          throw dbError;
        }
      }
      // Add empty keywordMetrics array to each scan
      scans = scans.map((s: any) => ({ ...s, keywordMetrics: s.keywordMetrics || [] }));
      console.log('[getServerSideProps] Found', scans.length, 'scans');
    } catch (scanError: any) {
      console.error('[getServerSideProps] Error fetching scans:', scanError);
      console.error('[getServerSideProps] Scan error details:', {
        message: scanError.message,
        code: scanError.code,
      });
      
      // If it's a table missing error, try fetching without keywordMetrics
      if (scanError.message?.includes('does not exist') || scanError.code === 'P2021') {
        console.log('[getServerSideProps] Table missing error - fetching scans without keywordMetrics');
        try {
          // Retry logic for fallback query too
          let retries = 3;
          while (retries > 0) {
            try {
              scans = await prisma.scan.findMany({
                where: { runId: id },
                orderBy: { opportunity: 'desc' },
              });
              break;
            } catch (dbError: any) {
              if (dbError.message?.includes('prepared statement') && retries > 1) {
                console.warn(`[getServerSideProps] Database connection error in fallback, retrying... (${retries - 1} retries left)`);
                retries--;
                await new Promise(resolve => setTimeout(resolve, 100));
                await prisma.$disconnect();
                await prisma.$connect();
                continue;
              }
              throw dbError;
            }
          }
          console.log('[getServerSideProps] Found', scans.length, 'scans (without keywordMetrics)');
          // Add empty keywordMetrics array to each scan
          scans = scans.map((s: any) => ({ ...s, keywordMetrics: [] }));
        } catch (retryError: any) {
          console.error('[getServerSideProps] Retry also failed:', retryError.message);
          throw scanError; // Throw original error
        }
      } else {
        throw scanError;
      }
    }

    console.log('[getServerSideProps] Processing scans...');

    // Prepare run data
    const runData = {
      id: run.id,
      niche: run.niche,
      notes: run.notes || null,
      payout: run.payout,
      createdAt: run.createdAt instanceof Date ? run.createdAt.toISOString() : run.createdAt,
      status: run.status,
    };
    
    console.log('[getServerSideProps] Prepared run data:', runData);

    // Process scans with error handling - skip problematic scans instead of failing
    const processedScans: any[] = [];
    for (let index = 0; index < scans.length; index++) {
      const s = scans[index];
      try {
        console.log(`[getServerSideProps] Processing scan ${index + 1}/${scans.length}:`, s.id);
        
        // Safely access new fields that might not exist on old records
        let timeToRank: string | null = null;
        let competitionStrength: number | null = null;
        let competitorJson: any = null;
        let relatedKeywords: string | null = null;
        
        try {
          // Access fields safely - they may not exist in Prisma types yet
          const scanAny = s as any;
          timeToRank = scanAny.timeToRank || null;
          competitionStrength = scanAny.competitionStrength ?? null;
          
          // Handle JSON field - ensure it's serializable
          if (scanAny.competitorJson) {
            try {
              if (typeof scanAny.competitorJson === 'object') {
                // Deep clone and sanitize to ensure serializability
                competitorJson = JSON.parse(JSON.stringify(scanAny.competitorJson));
              } else if (typeof scanAny.competitorJson === 'string') {
                competitorJson = JSON.parse(scanAny.competitorJson);
              }
            } catch (jsonError: any) {
              console.warn(`[getServerSideProps] Error parsing competitorJson for scan ${s.id}:`, jsonError.message);
              competitorJson = null; // Set to null if can't parse
            }
          }
          
          relatedKeywords = scanAny.relatedKeywords || null;
        } catch (e: any) {
          console.warn(`[getServerSideProps] Error accessing new fields for scan ${s.id}:`, e.message);
        }
        
        // Safely handle keywordMetrics - might not exist on old records
        const scanAny = s as any;
        const keywordMetricsArray = scanAny.keywordMetrics || [];
        
        if (keywordMetricsArray.length === 0 && scanAny.profitEst && scanAny.profitEst > 0) {
          console.warn(`[getServerSideProps] Scan ${s.id} has profit ${scanAny.profitEst} but no keywordMetrics - data may not be loaded`);
        }
        
        const result = {
          id: s.id,
          city: s.city || '',
          state: s.state || '',
          zip: s.zip || null,
          demandScore: s.demandScore || 0,
          difficulty: s.difficulty || 0,
          opportunity: s.opportunity || 0,
          profitEst: s.profitEst || null,
          classification: s.classification || null,
          keywords: s.keywords || null,
          keywordMetrics: Array.isArray(keywordMetricsArray) 
            ? keywordMetricsArray.map((k: any) => ({
                id: k.id,
                keyword: k.keyword,
                volume: k.volume,
                difficulty: k.difficulty,
                intent: k.intent,
                priority: k.priority,
                cpc: (k as any).cpc || null,
              }))
            : [],
          timeToRank: timeToRank || null,
          competitionStrength: competitionStrength,
          competitorJson: competitorJson,
          relatedKeywords: relatedKeywords,
        };
        
        // Test serialization before adding
        try {
          JSON.stringify(result);
          processedScans.push(result);
        } catch (serializeTestError: any) {
          console.error(`[getServerSideProps] Scan ${s.id} failed serialization test, skipping:`, serializeTestError.message);
          // Add minimal version instead
          processedScans.push({
            id: s.id,
            city: s.city || '',
            state: s.state || '',
            zip: s.zip || null,
            demandScore: s.demandScore || 0,
            difficulty: s.difficulty || 0,
            opportunity: s.opportunity || 0,
            profitEst: s.profitEst || null,
            classification: s.classification || null,
            keywords: s.keywords || null,
            keywordMetrics: [],
            timeToRank: null,
            competitionStrength: null,
            competitorJson: null,
            relatedKeywords: null,
          });
        }
      } catch (mapError: any) {
        console.error(`[getServerSideProps] Error mapping scan ${s.id}:`, mapError.message);
        console.error(`[getServerSideProps] Map error stack:`, mapError.stack);
        // Skip this scan but continue processing others
        console.warn(`[getServerSideProps] Skipping scan ${s.id} due to error, continuing with others...`);
      }
    }
    
    console.log('[getServerSideProps] Processed', processedScans.length, 'scans successfully');
    console.log('[getServerSideProps] Returning props...');

    const props = {
      run: runData,
      scans: processedScans,
    };
    
    // Validate props are serializable
    try {
      JSON.stringify(props);
      console.log('[getServerSideProps] Props are serializable ✓');
    } catch (serializeError: any) {
      console.error('[getServerSideProps] Props serialization error:', serializeError.message);
      console.error('[getServerSideProps] This will cause a 404!');
      throw serializeError;
    }

    console.log('[getServerSideProps] ✅ Successfully returning props');
    return { props };
  } catch (error: any) {
    console.error('\n[getServerSideProps] ========================================');
    console.error('[getServerSideProps] ❌ ERROR in getServerSideProps');
    console.error('[getServerSideProps] ========================================');
    console.error('[getServerSideProps] Run ID:', context.params?.id);
    console.error('[getServerSideProps] Error type:', error?.constructor?.name || 'Unknown');
    console.error('[getServerSideProps] Error message:', error?.message || 'No message');
    console.error('[getServerSideProps] Error stack:', error?.stack || 'No stack');
    
    // Log the full error for debugging
    if (error?.code) {
      console.error('[getServerSideProps] Error code:', error.code);
    }
    if (error?.meta) {
      console.error('[getServerSideProps] Error meta:', JSON.stringify(error.meta, null, 2));
    }
    if (error?.cause) {
      console.error('[getServerSideProps] Error cause:', error.cause);
    }
    console.error('[getServerSideProps] Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    console.error('[getServerSideProps] ========================================\n');
    
    // If it's a "not found" error, return 404
    if (error?.message?.includes('Record to find does not exist') || 
        error?.message?.includes('not found') ||
        error?.code === 'P2025') {
      console.log('[getServerSideProps] Record not found error, returning 404');
      return { notFound: true };
    }
    
    // For other errors, try to return partial data instead of 404
    // This allows the page to load even if there's a serialization issue
    console.error('[getServerSideProps] Unexpected error, attempting to return partial data');
    console.error('[getServerSideProps] This error should be visible in the server terminal!');
    
    // Try to at least return the run data if we have it
    try {
      // Retry logic for fallback query
      let run;
      let retries = 3;
      while (retries > 0) {
        try {
          run = await prisma.run.findUnique({ where: { id: id as string } });
          break;
        } catch (dbError: any) {
          if (dbError.message?.includes('prepared statement') && retries > 1) {
            retries--;
            await new Promise(resolve => setTimeout(resolve, 100));
            await prisma.$disconnect();
            await prisma.$connect();
            continue;
          }
          throw dbError;
        }
      }
      if (run) {
        const minimalProps = {
          run: {
            id: run.id,
            niche: run.niche,
            payout: run.payout,
            createdAt: run.createdAt instanceof Date ? run.createdAt.toISOString() : run.createdAt,
            status: run.status,
            notes: run.notes || null,
          },
          scans: [], // Empty scans array - page will show "No results yet"
        };
        console.log('[getServerSideProps] Returning minimal props with empty scans');
        return { props: minimalProps };
      }
    } catch (fallbackError: any) {
      console.error('[getServerSideProps] Even fallback failed:', fallbackError.message);
    }
    
    // Last resort: return 404
    return { notFound: true };
  }
};
