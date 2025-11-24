import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

interface Batch {
  id: string;
  name?: string;
  status: string;
  totalKeywords?: number;
  processedKeywords: number;
  skippedCities: number;
  createdAt: string;
  completedAt?: string;
  niche: {
    id: string;
    name: string;
    slug: string;
  };
}

export default function BatchesPage() {
  const router = useRouter();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBatches();
  }, []);

  const fetchBatches = async () => {
    try {
      setError(null);
      const res = await fetch('/api/v5000/batches', {
        credentials: 'include', // Ensure cookies are sent
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to fetch batches' }));
        if (res.status === 401) {
          setError('Unauthorized: Your session may have expired. Please log in again.');
        } else {
          setError(errorData.error || `Server error: ${res.status}`);
        }
        setBatches([]);
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setBatches(data);
      } else {
        setError(data.error || 'Invalid response format');
        setBatches([]);
      }
    } catch (error: any) {
      console.error('Error fetching batches:', error);
      setError(error.message || 'Failed to load batches');
      setBatches([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#28a745';
      case 'running':
        return '#007bff';
      case 'failed':
        return '#dc3545';
      case 'cancelled':
        return '#6c757d';
      default:
        return '#ffc107';
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem' }}>Loading...</div>;
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Batches</h1>
        <button
          onClick={() => router.push('/v5000/batches/new')}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '1rem',
          }}
        >
          New Batch
        </button>
      </div>

      {error && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '1rem',
            backgroundColor: '#f8d7da',
            color: '#721c24',
            borderRadius: '4px',
            border: '1px solid #f5c6cb',
          }}
        >
          <div style={{ marginBottom: error.includes('Unauthorized') ? '0.75rem' : '0' }}>
            <strong>Error:</strong> {error}
          </div>
          {error.includes('Unauthorized') && (
            <button
              onClick={() => router.push('/login')}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#0070f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              Go to Login
            </button>
          )}
        </div>
      )}

      {Array.isArray(batches) && batches.length === 0 && !error && (
        <p style={{ color: '#666' }}>No batches yet. Create a new batch to start scanning.</p>
      )}

      {Array.isArray(batches) && batches.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd' }}>
              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Name</th>
              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Niche</th>
              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Status</th>
              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Progress</th>
              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Created</th>
              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((batch) => (
              <tr
                key={batch.id}
                style={{ borderBottom: '1px solid #eee', cursor: 'pointer' }}
                onClick={() => router.push(`/v5000/batches/${batch.id}`)}
              >
                <td style={{ padding: '0.75rem' }}>{batch.name || 'Unnamed Batch'}</td>
                <td style={{ padding: '0.75rem' }}>{batch.niche.name}</td>
                <td style={{ padding: '0.75rem' }}>
                  <span style={{ color: getStatusColor(batch.status), fontWeight: 'bold' }}>
                    {batch.status.toUpperCase()}
                  </span>
                </td>
                <td style={{ padding: '0.75rem' }}>
                  {batch.totalKeywords
                    ? `${batch.processedKeywords} / ${batch.totalKeywords}`
                    : batch.processedKeywords}
                </td>
                <td style={{ padding: '0.75rem' }}>
                  {new Date(batch.createdAt).toLocaleDateString()}
                </td>
                <td style={{ padding: '0.75rem' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/v5000/batches/${batch.id}`);
                    }}
                    style={{
                      padding: '0.25rem 0.75rem',
                      backgroundColor: '#0070f3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}




