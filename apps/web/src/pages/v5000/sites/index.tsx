/**
 * Sites List Page
 * 
 * Lists all sites with filtering and sorting.
 */

import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

interface Site {
  id: string;
  niche: { name: string; slug: string };
  city: string;
  state: string;
  domain: string | null;
  status: string;
  createdAt: string;
  _count: { pages: number };
}

export default function SitesListPage() {
  const router = useRouter();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', nicheId: '' });

  useEffect(() => {
    fetchSites();
  }, [filter]);

  const fetchSites = async () => {
    try {
      const params = new URLSearchParams();
      if (filter.status) params.append('status', filter.status);
      if (filter.nicheId) params.append('nicheId', filter.nicheId);

      const res = await fetch(`/api/v5000/sites?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSites(data);
      }
    } catch (error) {
      console.error('Error fetching sites:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem' }}>Loading...</div>;
  }

  const statusColors: { [key: string]: string } = {
    setup_pending: '#ffc107',
    planning_ready: '#17a2b8',
    content_in_progress: '#007bff',
    ready_to_publish: '#28a745',
    live: '#28a745',
    error: '#dc3545',
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Sites</h1>
      </div>

      <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
        <select
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
        >
          <option value="">All Statuses</option>
          <option value="setup_pending">Setup Pending</option>
          <option value="planning_ready">Planning Ready</option>
          <option value="content_in_progress">Content In Progress</option>
          <option value="ready_to_publish">Ready to Publish</option>
          <option value="live">Live</option>
          <option value="error">Error</option>
        </select>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #ddd', backgroundColor: '#f8f9fa' }}>
            <th style={{ textAlign: 'left', padding: '0.75rem' }}>Niche</th>
            <th style={{ textAlign: 'left', padding: '0.75rem' }}>City</th>
            <th style={{ textAlign: 'left', padding: '0.75rem' }}>Domain</th>
            <th style={{ textAlign: 'center', padding: '0.75rem' }}>Status</th>
            <th style={{ textAlign: 'center', padding: '0.75rem' }}>Pages</th>
            <th style={{ textAlign: 'left', padding: '0.75rem' }}>Created</th>
            <th style={{ textAlign: 'center', padding: '0.75rem' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sites.map((site) => (
            <tr key={site.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.75rem' }}>{site.niche.name}</td>
              <td style={{ padding: '0.75rem' }}>{site.city}, {site.state}</td>
              <td style={{ padding: '0.75rem' }}>{site.domain || '-'}</td>
              <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                <span style={{
                  padding: '0.25rem 0.5rem',
                  backgroundColor: statusColors[site.status] || '#6c757d',
                  color: 'white',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}>
                  {site.status}
                </span>
              </td>
              <td style={{ padding: '0.75rem', textAlign: 'center' }}>{site._count.pages}</td>
              <td style={{ padding: '0.75rem' }}>
                {new Date(site.createdAt).toLocaleDateString()}
              </td>
              <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                <button
                  onClick={() => router.push(`/v5000/sites/${site.id}`)}
                  style={{
                    padding: '0.25rem 0.5rem',
                    backgroundColor: '#007bff',
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

      {sites.length === 0 && (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
          No sites found. Create one from a batch!
        </div>
      )}
    </div>
  );
}

