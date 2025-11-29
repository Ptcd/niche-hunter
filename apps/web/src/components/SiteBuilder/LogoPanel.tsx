/**
 * Logo Panel Component
 * 
 * Displays site logo with regenerate functionality
 */

import { useState, useEffect } from 'react';
import { generateDefaultLogoPrompt } from '@/lib/logoGenerator';

interface LogoPanelProps {
  siteId: string;
  logoUrl: string | null;
  brandName: string;
  niche: string;
  city?: string;
  state?: string;
  onLogoUpdate: () => void;
}

export default function LogoPanel({ siteId, logoUrl, brandName, niche, city, state, onLogoUpdate }: LogoPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);

  // Generate default prompt on mount
  useEffect(() => {
    const defaultPrompt = generateDefaultLogoPrompt(niche, city, state);
    setPrompt(defaultPrompt);
  }, [niche, city, state]);

  const handleReset = () => {
    const defaultPrompt = generateDefaultLogoPrompt(niche, city, state);
    setPrompt(defaultPrompt);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      alert('Please enter a prompt');
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch(`/api/v5000/sites/${siteId}/generate-logo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customPrompt: prompt.trim(),
        }),
      });

      if (res.ok) {
        onLogoUpdate();
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

      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <label style={{ fontWeight: 'bold', display: 'block' }}>
            DALL-E Prompt (editable)
          </label>
          <button
            onClick={handleReset}
            style={{
              padding: '0.25rem 0.75rem',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Reset to Default
          </button>
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your DALL-E prompt here..."
          style={{
            width: '100%',
            minHeight: '200px',
            padding: '0.75rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            lineHeight: '1.5',
            resize: 'vertical',
          }}
        />
        <small style={{ color: '#666', fontSize: '0.875rem', display: 'block', marginTop: '0.25rem' }}>
          Edit the prompt above to customize logo generation. The default prompt is optimized to avoid text in logos.
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

