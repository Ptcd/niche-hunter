import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

interface Niche {
  id: string;
  name: string;
  slug: string;
}

export default function NewBatchPage() {
  const router = useRouter();
  const { nicheId } = router.query;
  const [niches, setNiches] = useState<Niche[]>([]);
  const [selectedNicheId, setSelectedNicheId] = useState<string>(nicheId as string || '');
  const [batchName, setBatchName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchNiches();
    if (nicheId) {
      setSelectedNicheId(nicheId as string);
    }
  }, [nicheId]);

  const fetchNiches = async () => {
    try {
      const res = await fetch('/api/v5000/niches');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setNiches(data);
        }
      }
    } catch (error) {
      console.error('Error fetching niches:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNicheId) {
      alert('Please select a niche');
      return;
    }
    if (!file) {
      alert('Please select a CSV file');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('nicheId', selectedNicheId);
      formData.append('csv', file);
      if (batchName) {
        formData.append('name', batchName);
      }

      const res = await fetch('/api/v5000/batches', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const batch = await res.json();
        router.push(`/v5000/batches/${batch.id}`);
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to create batch');
      }
    } catch (error) {
      console.error('Error creating batch:', error);
      alert('Failed to create batch');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <button
          onClick={() => router.push('/v5000/batches')}
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
          ← Back to Batches
        </button>
        <h1>Create New Batch</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Niche *
          </label>
          <select
            value={selectedNicheId}
            onChange={(e) => setSelectedNicheId(e.target.value)}
            required
            style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }}
          >
            <option value="">Select a niche</option>
            {niches.map((niche) => (
              <option key={niche.id} value={niche.id}>
                {niche.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Batch Name (Optional)
          </label>
          <input
            type="text"
            value={batchName}
            onChange={(e) => setBatchName(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }}
            placeholder="e.g., Florida Cities Scan"
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Locations CSV *
          </label>
          <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
            Upload a CSV with columns: <code>city</code>, <code>state</code>, <code>payout</code>
          </p>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            required
            style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => router.push('/v5000/batches')}
            style={{
              padding: '0.75rem 1.5rem',
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
            disabled={loading}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: loading ? '#6c757d' : '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Creating...' : 'Create Batch'}
          </button>
        </div>
      </form>
    </div>
  );
}




