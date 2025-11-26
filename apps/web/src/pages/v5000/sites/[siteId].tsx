/**
 * Site Detail Page
 * 
 * Shows site information, page plan, and actions for content generation and publishing.
 */

import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

interface SitePage {
  id: string;
  pageType: string;
  slug: string;
  titleTag: string;
  h1: string;
  focusKeyword: string;
  contentStatus: string;
  wpPageId: string | null;
}

interface Site {
  id: string;
  niche: { name: string; slug: string };
  city: string;
  state: string;
  domain: string | null;
  phoneNumber: string | null;
  sheetId: string | null;
  wpBaseUrl: string | null;
  status: string;
  pages: SitePage[];
}

export default function SiteDetailPage() {
  const router = useRouter();
  const { siteId } = router.query;
  const [site, setSite] = useState<Site | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (siteId && typeof siteId === 'string') {
      fetchSite();
    }
  }, [siteId]);

  const fetchSite = async () => {
    try {
      const res = await fetch(`/api/v5000/sites/${siteId}`);
      if (res.ok) {
        const data = await res.json();
        setSite(data);
      }
    } catch (error) {
      console.error('Error fetching site:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateContent = async (mode: 'all' | 'page', pageId?: string) => {
    if (!confirm(`Generate content for ${mode === 'all' ? 'all pages' : 'this page'}?`)) {
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch(`/api/v5000/sites/${siteId}/generate-content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, pageId }),
      });

      if (res.ok) {
        const result = await res.json();
        alert(result.message);
        fetchSite();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to generate content');
      }
    } catch (error) {
      console.error('Error generating content:', error);
      alert('Failed to generate content');
    } finally {
      setGenerating(false);
    }
  };

  const handleSyncContent = async () => {
    if (!confirm('Sync all ready content to WordPress?')) {
      return;
    }

    setSyncing(true);
    try {
      const res = await fetch(`/api/v5000/sites/${siteId}/sync-content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'db' }),
      });

      if (res.ok) {
        const result = await res.json();
        alert(result.message);
        fetchSite();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to sync content');
      }
    } catch (error) {
      console.error('Error syncing content:', error);
      alert('Failed to sync content');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem' }}>Loading...</div>;
  }

  if (!site) {
    return <div style={{ padding: '2rem' }}>Site not found</div>;
  }

  const statusColors: { [key: string]: string } = {
    setup_pending: '#ffc107',
    planning_ready: '#17a2b8',
    content_in_progress: '#007bff',
    ready_to_publish: '#28a745',
    live: '#28a745',
    error: '#dc3545',
  };

  const contentStatusCounts = site.pages.reduce((acc, page) => {
    acc[page.contentStatus] = (acc[page.contentStatus] || 0) + 1;
    return acc;
  }, {} as { [key: string]: number });

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <button
          onClick={() => router.push('/v5000/sites')}
          style={{
            marginBottom: '1rem',
            padding: '0.5rem 1rem',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          ← Back to Sites
        </button>
        <h1>{site.niche.name} - {site.city}, {site.state}</h1>
      </div>

      <div style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div>
            <strong>Domain:</strong> {site.domain || 'Not set'}
          </div>
          <div>
            <strong>Phone:</strong> {site.phoneNumber || 'Not set'}
          </div>
          <div>
            <strong>Status:</strong>{' '}
            <span style={{ 
              padding: '0.25rem 0.5rem', 
              backgroundColor: statusColors[site.status] || '#6c757d',
              color: 'white',
              borderRadius: '4px',
              fontSize: '0.875rem',
            }}>
              {site.status}
            </span>
          </div>
          <div>
            <strong>Pages:</strong> {site.pages.length}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '2rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {site.sheetId && (
          <a
            href={`https://docs.google.com/spreadsheets/d/${site.sheetId}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#28a745',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '4px',
              fontWeight: 'bold',
            }}
          >
            📊 Open Content Sheet
          </a>
        )}
        <button
          onClick={() => handleGenerateContent('all')}
          disabled={generating}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: generating ? '#6c757d' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: generating ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
          }}
        >
          {generating ? 'Generating...' : '🤖 Generate Content with GPT'}
        </button>
        <button
          onClick={handleSyncContent}
          disabled={syncing}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: syncing ? '#6c757d' : '#17a2b8',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: syncing ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
          }}
        >
          {syncing ? 'Syncing...' : '🔄 Sync Content to Site'}
        </button>
        {site.domain && (
          <a
            href={`https://${site.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#6c757d',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '4px',
              fontWeight: 'bold',
            }}
          >
            👁️ View Site
          </a>
        )}
      </div>

      {Object.keys(contentStatusCounts).length > 0 && (
        <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #ddd' }}>
          <strong>Content Status:</strong>{' '}
          {Object.entries(contentStatusCounts).map(([status, count]) => (
            <span key={status} style={{ marginLeft: '1rem' }}>
              {status}: {count}
            </span>
          ))}
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #ddd', backgroundColor: '#f8f9fa' }}>
            <th style={{ textAlign: 'left', padding: '0.75rem' }}>Type</th>
            <th style={{ textAlign: 'left', padding: '0.75rem' }}>Slug</th>
            <th style={{ textAlign: 'left', padding: '0.75rem' }}>Title</th>
            <th style={{ textAlign: 'left', padding: '0.75rem' }}>Focus Keyword</th>
            <th style={{ textAlign: 'center', padding: '0.75rem' }}>Status</th>
            <th style={{ textAlign: 'center', padding: '0.75rem' }}>WP Link</th>
            <th style={{ textAlign: 'center', padding: '0.75rem' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {site.pages.map((page) => (
            <tr key={page.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.75rem' }}>{page.pageType}</td>
              <td style={{ padding: '0.75rem' }}>{page.slug}</td>
              <td style={{ padding: '0.75rem' }}>{page.titleTag}</td>
              <td style={{ padding: '0.75rem' }}>{page.focusKeyword}</td>
              <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                <span style={{
                  padding: '0.25rem 0.5rem',
                  backgroundColor: page.contentStatus === 'published' ? '#28a745' : '#6c757d',
                  color: 'white',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}>
                  {page.contentStatus}
                </span>
              </td>
              <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                {page.wpPageId && site.wpBaseUrl ? (
                  <a
                    href={`${site.wpBaseUrl}/wp-admin/post.php?post=${page.wpPageId}&action=edit`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#007bff' }}
                  >
                    View
                  </a>
                ) : (
                  '-'
                )}
              </td>
              <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                <button
                  onClick={() => handleGenerateContent('page', page.id)}
                  disabled={generating}
                  style={{
                    padding: '0.25rem 0.5rem',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: generating ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                  }}
                >
                  Generate
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


