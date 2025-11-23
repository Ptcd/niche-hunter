import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

interface Niche {
  id: string;
  name: string;
  slug: string;
  description?: string;
  keywords: Array<{ id: string }>;
}

export default function NichesPage() {
  const router = useRouter();
  const [niches, setNiches] = useState<Niche[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newNicheName, setNewNicheName] = useState('');
  const [newNicheDescription, setNewNicheDescription] = useState('');

  useEffect(() => {
    fetchNiches();
  }, []);

  const fetchNiches = async () => {
    try {
      setError(null);
      const res = await fetch('/api/v5000/niches');
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to fetch niches' }));
        setError(errorData.error || `Server error: ${res.status}`);
        setNiches([]);
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setNiches(data);
      } else {
        setError(data.error || 'Invalid response format');
        setNiches([]);
      }
    } catch (error: any) {
      console.error('Error fetching niches:', error);
      setError(error.message || 'Failed to load niches');
      setNiches([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNiche = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNicheName.trim()) {
      alert('Please enter a niche name');
      return;
    }

    try {
      const res = await fetch('/api/v5000/niches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newNicheName,
          description: newNicheDescription || null,
        }),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setNewNicheName('');
        setNewNicheDescription('');
        fetchNiches();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to create niche');
      }
    } catch (error) {
      console.error('Error creating niche:', error);
      alert('Failed to create niche');
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem' }}>Loading...</div>;
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Niches</h1>
        <button
          onClick={() => setShowCreateModal(true)}
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
          Create New Niche
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
          <strong>Error:</strong> {error}
        </div>
      )}

      {showCreateModal && (
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
          onClick={() => setShowCreateModal(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '2rem',
              borderRadius: '8px',
              maxWidth: '500px',
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Create New Niche</h2>
            <form onSubmit={handleCreateNiche}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Name *
                </label>
                <input
                  type="text"
                  value={newNicheName}
                  onChange={(e) => setNewNicheName(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }}
                  placeholder="e.g., HVAC, Junk Car Removal"
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Description
                </label>
                <textarea
                  value={newNicheDescription}
                  onChange={(e) => setNewNicheDescription(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', minHeight: '100px' }}
                  placeholder="Optional description"
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
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
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#0070f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {Array.isArray(niches) && niches.length === 0 && !error && (
        <p style={{ color: '#666' }}>No niches yet. Create your first niche to get started.</p>
      )}

      {Array.isArray(niches) && niches.length > 0 && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {niches.map((niche) => (
            <div
              key={niche.id}
              style={{
                padding: '1.5rem',
                border: '1px solid #ddd',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
              onClick={() => router.push(`/v5000/niches/${niche.id}`)}
            >
              <h2 style={{ marginTop: 0 }}>{niche.name}</h2>
              {niche.description && <p style={{ color: '#666' }}>{niche.description}</p>}
              <p style={{ color: '#666', fontSize: '0.9rem' }}>
                {niche.keywords?.length || 0} keywords
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}



