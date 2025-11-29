/**
 * Logo Panel Component
 * 
 * Displays site logo with regenerate functionality
 */

import { useState } from 'react';

interface LogoPanelProps {
  siteId: string;
  logoUrl: string | null;
  brandName: string;
  onLogoUpdate: () => void;
}

export default function LogoPanel({ siteId, logoUrl, brandName, onLogoUpdate }: LogoPanelProps) {
  const [promptHint, setPromptHint] = useState('');
  const [generating, setGenerating] = useState(false);
  const [rules, setRules] = useState({
    noText: true,
    whiteBackground: true,
    iconOnly: true,
  });

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/v5000/sites/${siteId}/generate-logo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptHint: promptHint.trim() || undefined,
          rules: {
            noText: rules.noText,
            whiteBackground: rules.whiteBackground,
            iconOnly: rules.iconOnly,
          },
        }),
      });

      if (res.ok) {
        onLogoUpdate();
        setPromptHint(''); // Clear hint after successful generation
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to generate logo');
      }
    } catch (error) {
      console.error('Error generating logo:', error);
      alert('Failed to generate logo');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={{
      border: '1px solid #ddd',
      borderRadius: '8px',
      padding: '1.5rem',
      marginBottom: '2rem',
      backgroundColor: '#f9f9f9'
    }}>
      <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>Logo</h2>
      
      {logoUrl ? (
        <div style={{ marginBottom: '1rem' }}>
          <img
            src={logoUrl}
            alt={`${brandName} logo`}
            style={{
              maxWidth: '200px',
              maxHeight: '200px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              padding: '0.5rem',
              backgroundColor: 'white'
            }}
          />
        </div>
      ) : (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: 'white',
          border: '2px dashed #ddd',
          borderRadius: '4px',
          marginBottom: '1rem',
          color: '#6c757d'
        }}>
          No logo yet. Generate one below.
        </div>
      )}

      <div style={{
        marginBottom: '1rem',
        padding: '1rem',
        backgroundColor: '#f8f9fa',
        border: '1px solid #dee2e6',
        borderRadius: '4px',
        fontSize: '0.875rem'
      }}>
        <strong style={{ display: 'block', marginBottom: '0.75rem', color: '#495057' }}>
          Logo Generation Rules (Toggle to enable/disable):
        </strong>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', color: '#495057' }}>
            <input
              type="checkbox"
              checked={rules.noText}
              onChange={(e) => setRules({ ...rules, noText: e.target.checked })}
              style={{ marginRight: '0.5rem', cursor: 'pointer' }}
            />
            <span>No text, letters, words, or numbers</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', color: '#495057' }}>
            <input
              type="checkbox"
              checked={rules.iconOnly}
              onChange={(e) => setRules({ ...rules, iconOnly: e.target.checked })}
              style={{ marginRight: '0.5rem', cursor: 'pointer' }}
            />
            <span>Icon/symbol only (no full logo designs)</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', color: '#495057' }}>
            <input
              type="checkbox"
              checked={rules.whiteBackground}
              onChange={(e) => setRules({ ...rules, whiteBackground: e.target.checked })}
              style={{ marginRight: '0.5rem', cursor: 'pointer' }}
            />
            <span>White background (uncheck for transparent)</span>
          </label>
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          Style Hint (optional)
        </label>
        <input
          type="text"
          value={promptHint}
          onChange={(e) => setPromptHint(e.target.value)}
          placeholder="e.g., modern, blue, minimalist, circular"
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
          }}
        />
        <small style={{ color: '#666', fontSize: '0.875rem', display: 'block', marginTop: '0.25rem' }}>
          Add style preferences (colors, shapes, style) - do not include text or words
        </small>
      </div>

      <button
        onClick={handleGenerate}
        disabled={generating}
        style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: generating ? '#ccc' : '#0070f3',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: generating ? 'not-allowed' : 'pointer',
          fontSize: '1rem',
          fontWeight: '500'
        }}
      >
        {generating ? 'Generating...' : logoUrl ? 'Try Again' : 'Generate Logo'}
      </button>
      
      {logoUrl && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
          Cost: ~$0.04 per generation
        </div>
      )}
    </div>
  );
}

