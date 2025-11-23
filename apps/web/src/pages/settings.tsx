import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Settings() {
  const [searchAtlasApiKey, setSearchAtlasApiKey] = useState('');
  const [minimumVolume, setMinimumVolume] = useState(1000);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Load current API key
    fetch('/api/settings/searchatlas-api-key')
      .then(res => res.json())
      .then(data => {
        if (data.apiKey) {
          setSearchAtlasApiKey(data.apiKey);
        }
      })
      .catch(err => console.error('Failed to load API key:', err));
    
    // Load current minimum volume threshold
    fetch('/api/settings/minimum-broad-volume')
      .then(res => res.json())
      .then(data => {
        if (data.threshold) {
          setMinimumVolume(data.threshold);
        }
      })
      .catch(err => console.error('Failed to load threshold:', err));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSaved(false);

    try {
      // Save API key
      const apiKeyResponse = await fetch('/api/settings/searchatlas-api-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey: searchAtlasApiKey }),
      });

      const apiKeyData = await apiKeyResponse.json();
      if (!apiKeyResponse.ok) {
        throw new Error(apiKeyData.error || 'Failed to save API key');
      }

      // Save minimum volume threshold
      const thresholdResponse = await fetch('/api/settings/minimum-broad-volume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ threshold: minimumVolume }),
      });

      const thresholdData = await thresholdResponse.json();
      if (!thresholdResponse.ok) {
        throw new Error(thresholdData.error || 'Failed to save threshold');
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <Link href="/" style={{ color: '#0070f3', textDecoration: 'none' }}>
          ← Back to Dashboard
        </Link>
      </div>

      <h1 style={{ marginBottom: '2rem' }}>Settings</h1>

      <div style={{ 
        background: '#f5f5f5', 
        padding: '1.5rem', 
        borderRadius: '8px',
        marginBottom: '2rem'
      }}>
        <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>SearchAtlas API Configuration</h2>
        <p style={{ color: '#666', marginBottom: '1.5rem' }}>
          Enter your SearchAtlas API key to use the API instead of browser automation.
          This will make analysis faster and more reliable.
        </p>

        <form onSubmit={handleSave}>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="apiKey" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              SearchAtlas API Key
            </label>
            <input
              id="apiKey"
              type="password"
              value={searchAtlasApiKey}
              onChange={(e) => setSearchAtlasApiKey(e.target.value)}
              placeholder="Enter your SearchAtlas API key"
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontFamily: 'monospace'
              }}
            />
            <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.5rem' }}>
              Get your API key from SearchAtlas Settings → API Keys
            </p>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="minimumVolume" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Minimum Broad Volume Threshold
            </label>
            <input
              id="minimumVolume"
              type="number"
              min="0"
              step="100"
              value={minimumVolume}
              onChange={(e) => setMinimumVolume(parseInt(e.target.value) || 1000)}
              placeholder="1000"
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
              }}
            />
            <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.5rem' }}>
              Keywords with national search volume below this threshold will be rejected during validation.
              Default: 1,000 searches/month.
            </p>
          </div>

          {error && (
            <div style={{ 
              background: '#fee', 
              color: '#c33', 
              padding: '0.75rem', 
              borderRadius: '4px',
              marginBottom: '1rem'
            }}>
              {error}
            </div>
          )}

          {saved && (
            <div style={{ 
              background: '#efe', 
              color: '#3c3', 
              padding: '0.75rem', 
              borderRadius: '4px',
              marginBottom: '1rem'
            }}>
              ✅ API key saved successfully!
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: loading ? '#ccc' : '#0070f3',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 'bold'
            }}
          >
            {loading ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </div>

      <div style={{ 
        background: '#fff3cd', 
        padding: '1rem', 
        borderRadius: '8px',
        border: '1px solid #ffc107'
      }}>
        <h3 style={{ marginTop: 0 }}>How to get your API key:</h3>
        <ol style={{ marginBottom: 0, paddingLeft: '1.5rem' }}>
          <li>Log into your SearchAtlas account</li>
          <li>Go to Settings → API Keys</li>
          <li>Copy your API key</li>
          <li>Paste it above and click Save</li>
        </ol>
        <p style={{ marginTop: '1rem', marginBottom: 0, fontSize: '0.875rem' }}>
          <strong>Note:</strong> If SearchAtlas doesn't provide an API key, the system will automatically use browser automation instead.
        </p>
      </div>
    </div>
  );
}

