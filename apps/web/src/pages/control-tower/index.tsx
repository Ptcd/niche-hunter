/**
 * Control Tower Dashboard
 * 
 * Overview of all sites with metrics, status, and quick actions.
 */

import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

interface SiteMetrics {
  totalPages: number;
  publishedPages: number;
  coverage: number;
  calls7d: number;
  views7d: number;
  clicks7d: number;
  impressions7d: number;
  avgPosition7d: number | null;
}

interface Site {
  id: string;
  name: string;
  domain: string | null;
  status: string;
  niche: { name: string; slug: string };
  city: string;
  state: string;
  trackingNumber: string | null;
  metrics: SiteMetrics;
  monthlyCost: number;
  monthlyRevenue: number;
  monthlyProfit: number;
  leads30d: number;
  healthStatus: string;
  alerts: number;
  lastCitationUpdate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Summary {
  totalSites: number;
  liveSites: number;
  totalCalls7d: number;
  avgCoverage: number;
}

export default function ControlTowerPage() {
  const router = useRouter();
  const [sites, setSites] = useState<Site[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterNiche, setFilterNiche] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'coverage' | 'calls' | 'created'>('created');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/v5000/control-tower');
      if (res.ok) {
        const data = await res.json();
        setSites(data.sites);
        setSummary(data.summary);
      }
    } catch (error) {
      console.error('Error fetching control tower data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort sites
  const filteredSites = sites
    .filter((site) => {
      if (filterStatus !== 'all' && site.status !== filterStatus) return false;
      if (filterNiche !== 'all' && site.niche.slug !== filterNiche) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          site.name.toLowerCase().includes(query) ||
          site.domain?.toLowerCase().includes(query) ||
          site.city.toLowerCase().includes(query) ||
          site.state.toLowerCase().includes(query)
        );
      }
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'coverage':
          comparison = a.metrics.coverage - b.metrics.coverage;
          break;
        case 'calls':
          comparison = a.metrics.calls7d - b.metrics.calls7d;
          break;
        case 'created':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const uniqueNiches = Array.from(new Set(sites.map((s) => s.niche.slug)));

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'LIVE':
        return '#28a745';
      case 'DRAFTING':
        return '#ffc107';
      case 'REVIEW_NEEDED':
        return '#17a2b8';
      case 'SETUP_PENDING':
        return '#6c757d';
      case 'ERROR':
        return '#dc3545';
      default:
        return '#6c757d';
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div>Loading Control Tower...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ marginBottom: '2rem' }}>Control Tower</h1>

      {/* Summary Stats */}
      {summary && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem',
          }}
        >
          <div style={{ padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{summary.totalSites}</div>
            <div style={{ color: '#666' }}>Total Sites</div>
          </div>
          <div style={{ padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{summary.liveSites}</div>
            <div style={{ color: '#666' }}>Live Sites</div>
          </div>
          <div style={{ padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{summary.totalCalls7d}</div>
            <div style={{ color: '#666' }}>Calls (7d)</div>
          </div>
          <div style={{ padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
              {Math.round(summary.avgCoverage * 100)}%
            </div>
            <div style={{ color: '#666' }}>Avg Coverage</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '1rem',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <input
          type="text"
          placeholder="Search sites..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            padding: '0.5rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
            flex: '1',
            minWidth: '200px',
          }}
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
        >
          <option value="all">All Status</option>
          <option value="LIVE">Live</option>
          <option value="GENERATING">Generating</option>
          <option value="REVIEW">Review</option>
          <option value="SETUP">Setup</option>
          <option value="PAUSED">Paused</option>
          <option value="ERROR">Error</option>
        </select>
        <select
          value={filterNiche}
          onChange={(e) => setFilterNiche(e.target.value)}
          style={{ padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
        >
          <option value="all">All Niches</option>
          {uniqueNiches.map((niche) => (
            <option key={niche} value={niche}>
              {sites.find((s) => s.niche.slug === niche)?.niche.name || niche}
            </option>
          ))}
        </select>
        <button
          onClick={fetchData}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Refresh
        </button>
      </div>

      {/* Sites Table */}
      <div style={{ border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
              <th
                style={{
                  textAlign: 'left',
                  padding: '1rem',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  if (sortBy === 'name') {
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortBy('name');
                    setSortOrder('asc');
                  }
                }}
              >
                Site Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th style={{ textAlign: 'left', padding: '1rem' }}>Domain</th>
              <th style={{ textAlign: 'left', padding: '1rem' }}>Niche</th>
              <th style={{ textAlign: 'left', padding: '1rem' }}>Location</th>
              <th
                style={{
                  textAlign: 'left',
                  padding: '1rem',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  if (sortBy === 'status') {
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortBy('status');
                    setSortOrder('asc');
                  }
                }}
              >
                Status {sortBy === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th
                style={{
                  textAlign: 'left',
                  padding: '1rem',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  if (sortBy === 'coverage') {
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortBy('coverage');
                    setSortOrder('desc');
                  }
                }}
              >
                Progress {sortBy === 'coverage' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th
                style={{
                  textAlign: 'left',
                  padding: '1rem',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  if (sortBy === 'calls') {
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortBy('calls');
                    setSortOrder('desc');
                  }
                }}
              >
                Metrics (7d) {sortBy === 'calls' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th style={{ textAlign: 'left', padding: '1rem' }}>Leads (30d)</th>
              <th style={{ textAlign: 'left', padding: '1rem' }}>Cost/Mo</th>
              <th style={{ textAlign: 'left', padding: '1rem' }}>Revenue/Mo</th>
              <th style={{ textAlign: 'left', padding: '1rem' }}>Profit</th>
              <th style={{ textAlign: 'left', padding: '1rem' }}>Health</th>
              <th style={{ textAlign: 'left', padding: '1rem' }}>Alerts</th>
              <th style={{ textAlign: 'left', padding: '1rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSites.map((site) => (
              <tr
                key={site.id}
                style={{
                  borderBottom: '1px solid #eee',
                  cursor: 'pointer',
                }}
                onClick={() => router.push(`/sites/${site.id}`)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                <td style={{ padding: '1rem', fontWeight: '500' }}>{site.name}</td>
                <td style={{ padding: '1rem' }}>
                  {site.domain ? (
                    <a
                      href={`https://${site.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{ color: '#0070f3', textDecoration: 'none' }}
                    >
                      {site.domain}
                    </a>
                  ) : (
                    <span style={{ color: '#999' }}>No domain</span>
                  )}
                </td>
                <td style={{ padding: '1rem' }}>{site.niche.name}</td>
                <td style={{ padding: '1rem' }}>
                  {site.city}, {site.state}
                </td>
                <td style={{ padding: '1rem' }}>
                  <span
                    style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      backgroundColor: getStatusColor(site.status),
                      color: 'white',
                      fontSize: '0.875rem',
                    }}
                  >
                    {site.status}
                  </span>
                </td>
                <td style={{ padding: '1rem' }}>
                  <div style={{ marginBottom: '0.25rem' }}>
                    {site.metrics.publishedPages}/{site.metrics.totalPages} pages
                  </div>
                  <div
                    style={{
                      width: '100px',
                      height: '8px',
                      backgroundColor: '#e9ecef',
                      borderRadius: '4px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${site.metrics.coverage * 100}%`,
                        height: '100%',
                        backgroundColor: site.metrics.coverage > 0.8 ? '#28a745' : site.metrics.coverage > 0.5 ? '#ffc107' : '#dc3545',
                      }}
                    />
                  </div>
                </td>
                <td style={{ padding: '1rem', fontSize: '0.875rem' }}>
                  <div>Calls: {site.metrics.calls7d}</div>
                  <div>Views: {site.metrics.views7d}</div>
                  {site.metrics.avgPosition7d && (
                    <div>Pos: {site.metrics.avgPosition7d.toFixed(1)}</div>
                  )}
                </td>
                <td style={{ padding: '1rem', fontSize: '0.875rem' }}>
                  {site.leads30d || 0}
                </td>
                <td style={{ padding: '1rem', fontSize: '0.875rem' }}>
                  ${site.monthlyCost.toFixed(2)}
                </td>
                <td style={{ padding: '1rem', fontSize: '0.875rem' }}>
                  ${site.monthlyRevenue.toFixed(2)}
                </td>
                <td style={{ padding: '1rem', fontSize: '0.875rem', fontWeight: 'bold', color: site.monthlyProfit >= 0 ? '#28a745' : '#dc3545' }}>
                  ${site.monthlyProfit.toFixed(2)}
                </td>
                <td style={{ padding: '1rem' }}>
                  <span style={{
                    display: 'inline-block',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: site.healthStatus === 'healthy' ? '#28a745' : 
                                     site.healthStatus === 'degraded' ? '#ffc107' : '#dc3545',
                  }} />
                </td>
                <td style={{ padding: '1rem' }}>
                  {site.alerts > 0 && (
                    <span
                      style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '50%',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        fontSize: '0.875rem',
                      }}
                    >
                      {site.alerts}
                    </span>
                  )}
                </td>
                <td style={{ padding: '1rem' }} onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => router.push(`/sites/${site.id}`)}
                    style={{
                      padding: '0.25rem 0.75rem',
                      backgroundColor: '#0070f3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                    }}
                  >
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredSites.length === 0 && (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
          No sites found matching your filters.
        </div>
      )}
    </div>
  );
}

