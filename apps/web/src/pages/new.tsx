import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function NewRun() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [niche, setNiche] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [useNicheColumn, setUseNicheColumn] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!file) {
      setError('Please select a CSV file');
      setLoading(false);
      return;
    }

    if (!useNicheColumn && !niche.trim()) {
      setError('Please enter a niche or select "Use niche from CSV column"');
      setLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('niche', niche);
      formData.append('useNicheColumn', useNicheColumn.toString());

      const response = await fetch('/api/runs/create', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create run');
      }

      // Redirect to the run details page
      router.push(`/runs/${data.runId}`);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <Link href="/">← Back to Runs</Link>
      </div>

      <h1>Create New Analysis</h1>
      
      <div style={{ 
        backgroundColor: '#f0f8ff', 
        padding: '1rem', 
        borderRadius: '8px', 
        marginBottom: '2rem',
        border: '1px solid #b0d4ff'
      }}>
        <h3 style={{ marginTop: 0 }}>CSV Format</h3>
        <p>Your CSV should have columns: <code>city</code>, <code>state</code>, <code>zip</code> (optional), <code>payout</code>, and optionally <code>niche</code>.</p>
        <p><strong>Example:</strong></p>
        <pre style={{ backgroundColor: 'white', padding: '0.5rem', borderRadius: '4px', overflow: 'auto' }}>
{`city,state,zip,payout,niche
Minneapolis,MN,55421,162.00,roofing
Los Angeles,CA,90001,166.95,roofing`}
        </pre>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            CSV File (up to 100 locations)
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            required
            style={{ 
              padding: '0.5rem', 
              border: '1px solid #ddd', 
              borderRadius: '4px',
              width: '100%',
              maxWidth: '400px'
            }}
          />
          {file && (
            <p style={{ marginTop: '0.5rem', color: '#666', fontSize: '0.9rem' }}>
              Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>

        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <input
              type="checkbox"
              checked={useNicheColumn}
              onChange={(e) => setUseNicheColumn(e.target.checked)}
            />
            <span>Use niche from CSV column (if present)</span>
          </label>
        </div>

        {!useNicheColumn && (
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Niche Category *
            </label>
            <input
              type="text"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="e.g., roofing, plumbing, junk-car-removal"
              required={!useNicheColumn}
              style={{ 
                padding: '0.5rem', 
                border: '1px solid #ddd', 
                borderRadius: '4px',
                width: '100%',
                maxWidth: '300px'
              }}
            />
            <p style={{ marginTop: '0.5rem', color: '#666', fontSize: '0.9rem' }}>
              Must have a keyword file at <code>packages/core/keywords/[niche].json</code>
            </p>
          </div>
        )}

        {error && (
          <div style={{ 
            backgroundColor: '#fee', 
            color: '#c33', 
            padding: '1rem', 
            borderRadius: '4px',
            border: '1px solid #fcc'
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '0.75rem 2rem',
            backgroundColor: loading ? '#ccc' : '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
            fontWeight: 'bold',
            maxWidth: '200px'
          }}
        >
          {loading ? 'Starting Analysis...' : 'Start Analysis'}
        </button>
      </form>

      {loading && (
        <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f0f8ff', borderRadius: '8px' }}>
          <p>⏳ Uploading file and starting analysis...</p>
          <p style={{ fontSize: '0.9rem', color: '#666' }}>
            This may take a moment. You'll be redirected to the results page when it starts.
          </p>
        </div>
      )}
    </div>
  );
}

