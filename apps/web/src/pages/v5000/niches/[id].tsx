import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

interface NicheKeyword {
  id: string;
  keyword: string;
  nationalVolume?: number;
  nationalKd?: number;
  intent: string;
  isActive: boolean;
  notes?: string;
}

interface Niche {
  id: string;
  name: string;
  slug: string;
  description?: string;
  keywords: NicheKeyword[];
}

export default function NicheDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [niche, setNiche] = useState<Niche | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    if (id) {
      fetchNiche();
    }
  }, [id]);

  const fetchNiche = async () => {
    try {
      const res = await fetch(`/api/v5000/niches/${id}`);
      if (res.ok) {
        const data = await res.json();
        setNiche(data);
      }
    } catch (error) {
      console.error('Error fetching niche:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem' }}>Loading...</div>;
  }

  if (!niche) {
    return <div style={{ padding: '2rem' }}>Niche not found</div>;
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <button
          onClick={() => router.push('/v5000/niches')}
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
          ← Back to Niches
        </button>
        <h1>{niche.name}</h1>
        {niche.description && <p style={{ color: '#666' }}>{niche.description}</p>}
      </div>

      <div style={{ marginBottom: '2rem', display: 'flex', gap: '1rem' }}>
        <button
          onClick={() => setShowUploadModal(true)}
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
          Upload CSV Keywords
        </button>
        <button
          onClick={() => router.push(`/v5000/batches/new?nicheId=${id}`)}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '1rem',
          }}
        >
          Start New Scan
        </button>
      </div>

      <h2>Keywords ({niche.keywords?.length || 0})</h2>
      {niche.keywords && niche.keywords.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd' }}>
              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Keyword</th>
              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Volume</th>
              <th style={{ textAlign: 'left', padding: '0.75rem' }}>KD</th>
              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Intent</th>
              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {niche.keywords.map((kw) => (
              <tr key={kw.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.75rem' }}>{kw.keyword}</td>
                <td style={{ padding: '0.75rem' }}>{kw.nationalVolume || '-'}</td>
                <td style={{ padding: '0.75rem' }}>{kw.nationalKd || '-'}</td>
                <td style={{ padding: '0.75rem' }}>{kw.intent}</td>
                <td style={{ padding: '0.75rem' }}>
                  {kw.isActive ? (
                    <span style={{ color: '#28a745' }}>Active</span>
                  ) : (
                    <span style={{ color: '#dc3545' }}>Inactive</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p style={{ color: '#666' }}>No keywords yet. Upload a CSV to add keywords.</p>
      )}

      {showUploadModal && (
        <KeywordUploadModal
          nicheId={id as string}
          onClose={() => setShowUploadModal(false)}
          onKeywordsAdded={() => {
            setShowUploadModal(false);
            fetchNiche();
          }}
        />
      )}
    </div>
  );
}

function KeywordUploadModal({
  nicheId,
  onClose,
  onKeywordsAdded,
}: {
  nicheId: string;
  onClose: () => void;
  onKeywordsAdded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [topCount, setTopCount] = useState(20);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ added: number; skipped: number; keywords: string[] } | null>(null);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      alert('Please select a CSV file');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('csv', file);
      formData.append('topCount', topCount.toString());

      const res = await fetch(`/api/v5000/niches/${nicheId}/upload-keywords`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data);
        if (data.added > 0) {
          setTimeout(() => {
            onKeywordsAdded();
          }, 1500);
        }
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to upload keywords');
      }
    } catch (error) {
      console.error('Error uploading keywords:', error);
      alert('Failed to upload keywords');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: '2rem',
          borderRadius: '8px',
          maxWidth: '600px',
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Upload CSV Keywords</h2>
        <p style={{ color: '#666', marginBottom: '1rem', fontSize: '0.9rem' }}>
          Upload a CSV from SearchAtlas with columns: <code>keyword</code> and <code>sv</code> (search volume).
          The system will automatically select the top {topCount} highest volume keywords.
        </p>

        {result && (
          <div
            style={{
              marginBottom: '1rem',
              padding: '1rem',
              backgroundColor: result.added > 0 ? '#d4edda' : '#f8d7da',
              color: result.added > 0 ? '#155724' : '#721c24',
              borderRadius: '4px',
            }}
          >
            <strong>Upload Complete:</strong> {result.added} keywords added, {result.skipped} skipped (duplicates or
            errors)
          </div>
        )}

        <form onSubmit={handleUpload}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>CSV File</label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required
              style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Number of Top Keywords to Add
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={topCount}
              onChange={(e) => setTopCount(parseInt(e.target.value) || 20)}
              style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !file}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: loading ? '#6c757d' : '#0070f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Uploading...' : 'Upload & Add Top Keywords'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}




