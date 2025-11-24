/**
 * Citations Panel Component
 * 
 * Displays and manages citations for a site.
 */

import { useState, useEffect } from 'react';

interface Citation {
  id: string;
  source: string;
  url: string;
  nap: string | null;
  verified: boolean;
  updatedAt: string;
}

interface CitationsPanelProps {
  siteId: string;
}

export default function CitationsPanel({ siteId }: CitationsPanelProps) {
  const [citations, setCitations] = useState<Citation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCitation, setNewCitation] = useState({
    source: '',
    url: '',
    nap: '',
    listedName: '',
    listedAddress: '',
    listedPhone: '',
    priority: 3,
  });

  useEffect(() => {
    fetchCitations();
  }, [siteId]);

  const fetchCitations = async () => {
    try {
      const res = await fetch(`/api/v5000/sites/${siteId}/citations`);
      if (res.ok) {
        const data = await res.json();
        setCitations(data.citations || []);
      }
    } catch (error) {
      console.error('Error fetching citations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newCitation.source || !newCitation.url) {
      alert('Source and URL are required');
      return;
    }

    try {
      const res = await fetch(`/api/v5000/sites/${siteId}/citations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCitation),
      });

      if (res.ok) {
        setShowAddModal(false);
        setNewCitation({ source: '', url: '', nap: '', listedName: '', listedAddress: '', listedPhone: '', priority: 3 });
        fetchCitations();
      } else {
        alert('Failed to add citation');
      }
    } catch (error) {
      console.error('Error adding citation:', error);
      alert('Failed to add citation');
    }
  };

  const handleDelete = async (citationId: string) => {
    if (!confirm('Delete this citation?')) return;

    try {
      const res = await fetch(`/api/v5000/sites/${siteId}/citations/${citationId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchCitations();
      } else {
        alert('Failed to delete citation');
      }
    } catch (error) {
      console.error('Error deleting citation:', error);
      alert('Failed to delete citation');
    }
  };

  const getCitationStatus = (updatedAt: string): { color: string; label: string } => {
    const daysSince = Math.floor(
      (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSince <= 30) {
      return { color: '#28a745', label: 'Recent' };
    } else if (daysSince <= 60) {
      return { color: '#ffc107', label: 'Stale' };
    } else {
      return { color: '#dc3545', label: 'Very Stale' };
    }
  };

  if (loading) {
    return <div style={{ padding: '1rem' }}>Loading citations...</div>;
  }

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '1.5rem', marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Citations</h2>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Add Citation
        </button>
      </div>

      {citations.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
          No citations yet. Add your first citation to get started.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd' }}>
              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Source</th>
              <th style={{ textAlign: 'left', padding: '0.75rem' }}>URL</th>
              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Status</th>
              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Last Updated</th>
              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {citations.map((citation) => {
              const status = getCitationStatus(citation.updatedAt);
              return (
                <tr key={citation.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.75rem' }}>{citation.source}</td>
                  <td style={{ padding: '0.75rem' }}>
                    <a
                      href={citation.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#0070f3', textDecoration: 'none' }}
                    >
                      {citation.url.length > 50 ? citation.url.substring(0, 50) + '...' : citation.url}
                    </a>
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <span
                      style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        backgroundColor: status.color,
                        color: 'white',
                        fontSize: '0.875rem',
                      }}
                    >
                      {status.label}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                    {new Date(citation.updatedAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <button
                      onClick={() => handleDelete(citation.id)}
                      style={{
                        padding: '0.25rem 0.75rem',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Add Citation Modal */}
      {showAddModal && (
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
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '2rem',
              borderRadius: '8px',
              maxWidth: '500px',
              width: '90%',
            }}
          >
            <h2 style={{ marginTop: 0 }}>Add Citation</h2>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Source *
              </label>
              <input
                type="text"
                value={newCitation.source}
                onChange={(e) => setNewCitation({ ...newCitation, source: e.target.value })}
                placeholder="Google Business Profile, Yelp, Angi, etc."
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                URL *
              </label>
              <input
                type="url"
                value={newCitation.url}
                onChange={(e) => setNewCitation({ ...newCitation, url: e.target.value })}
                placeholder="https://..."
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Listed Name (for NAP consistency)
              </label>
              <input
                type="text"
                value={newCitation.listedName}
                onChange={(e) => setNewCitation({ ...newCitation, listedName: e.target.value })}
                placeholder="Business Name as listed on this citation"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Listed Address (optional)
              </label>
              <input
                type="text"
                value={newCitation.listedAddress}
                onChange={(e) => setNewCitation({ ...newCitation, listedAddress: e.target.value })}
                placeholder="123 Main St, City, State"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Listed Phone (for NAP consistency)
              </label>
              <input
                type="text"
                value={newCitation.listedPhone}
                onChange={(e) => setNewCitation({ ...newCitation, listedPhone: e.target.value })}
                placeholder="+1-813-555-1234"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Priority (1=critical, 5=low)
              </label>
              <select
                value={newCitation.priority}
                onChange={(e) => setNewCitation({ ...newCitation, priority: parseInt(e.target.value) })}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
              >
                <option value={1}>1 - Critical (Google Business Profile, etc.)</option>
                <option value={2}>2 - High</option>
                <option value={3}>3 - Medium</option>
                <option value={4}>4 - Low</option>
                <option value={5}>5 - Very Low</option>
              </select>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                NAP (Name, Address, Phone) - Optional Legacy Field
              </label>
              <textarea
                value={newCitation.nap}
                onChange={(e) => setNewCitation({ ...newCitation, nap: e.target.value })}
                placeholder="Business Name, 123 Main St, City, State, Phone"
                rows={2}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewCitation({ 
                    source: '', 
                    url: '', 
                    nap: '',
                    listedName: '',
                    listedAddress: '',
                    listedPhone: '',
                    priority: 3,
                  });
                }}
                style={{ padding: '0.5rem 1rem', cursor: 'pointer', border: '1px solid #ddd', borderRadius: '4px' }}
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Add Citation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

