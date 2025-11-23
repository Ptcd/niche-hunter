/**
 * Client Portal Page
 * 
 * Public-facing dashboard for clients to view their site metrics.
 */

import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function ClientPortalPage() {
  const router = useRouter();
  const { token } = router.query;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetch(`/api/client-portal/${token}`)
        .then(res => res.json())
        .then(data => {
          setData(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [token]);

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div>Loading dashboard...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div>Portal not found or invalid token.</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ marginBottom: '0.5rem' }}>{data.site.siteName || 'Client Dashboard'}</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        {data.site.city}, {data.site.state}
        {data.site.domain && ` • ${data.site.domain}`}
      </p>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#0070f3' }}>{data.metrics.calls30d}</div>
          <div style={{ color: '#666' }}>Calls (30 days)</div>
        </div>
        <div style={{ padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#28a745' }}>{data.metrics.formLeads30d}</div>
          <div style={{ color: '#666' }}>Form Leads (30 days)</div>
        </div>
        <div style={{ padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#17a2b8' }}>{data.metrics.gscClicks30d}</div>
          <div style={{ color: '#666' }}>Website Visitors (30 days)</div>
        </div>
        <div style={{ padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ffc107' }}>{data.metrics.impressions30d}</div>
          <div style={{ color: '#666' }}>Search Impressions (30 days)</div>
        </div>
        {data.metrics.avgPosition30d && (
          <div style={{ padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#6c757d' }}>{data.metrics.avgPosition30d.toFixed(1)}</div>
            <div style={{ color: '#666' }}>Avg Position (30 days)</div>
          </div>
        )}
      </div>

      {data.keywords && data.keywords.length > 0 && (
        <>
          <h2 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Top Keywords</h2>
          <div style={{ border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
                  <th style={{ textAlign: 'left', padding: '0.75rem' }}>Keyword</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem' }}>Position</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem' }}>Impressions</th>
                </tr>
              </thead>
              <tbody>
                {data.keywords.map((kw: any) => (
                  <tr key={kw.keyword} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '0.75rem' }}>{kw.keyword}</td>
                    <td style={{ padding: '0.75rem' }}>{kw.position.toFixed(1)}</td>
                    <td style={{ padding: '0.75rem' }}>{kw.impressions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

