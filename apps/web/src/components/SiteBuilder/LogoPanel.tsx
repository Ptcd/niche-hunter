/**
 * Logo Panel Component
 * 
 * Displays site logo with regenerate functionality
 */

import { useState, useEffect } from 'react';

/**
 * Generate a default logo prompt template
 * (Defined inline to avoid importing server-side OpenAI SDK)
 */
function generateDefaultLogoPrompt(niche: string, city?: string, state?: string): string {
  let prompt = `Create a simple pictorial mark (icon only, absolutely no text or letters) for a ${niche} business`;
  if (city && state) {
    prompt += ` in ${city}, ${state}`;
  }
  prompt += `.\n\nStyle:\n- Pure visual symbol, no words or characters\n- Simple geometric or abstract design\n- Clean, minimal, professional\n- Works well at small sizes\n- White background\n\nCreate only the icon/symbol - no text, no brand name, no letters.`;
  return prompt;
}

interface LogoPanelProps {
  siteId: string;
  logoUrl: string | null;
  brandName: string;
  niche: string;
  city?: string;
  state?: string;
  onLogoUpdate: () => void;
}

interface LogoConcept {
  name: string;
  description: string;
  prompt: string;
}

export default function LogoPanel({ siteId, logoUrl, brandName, niche, city, state, onLogoUpdate }: LogoPanelProps) {
  const [concepts, setConcepts] = useState<LogoConcept[]>([]);
  const [loadingConcepts, setLoadingConcepts] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedConcept, setSelectedConcept] = useState<LogoConcept | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [prompt, setPrompt] = useState('');

  // Generate default prompt on mount
  useEffect(() => {
    const defaultPrompt = generateDefaultLogoPrompt(niche, city, state);
    setPrompt(defaultPrompt);
  }, [niche, city, state]);

  const handleGenerateConcepts = async () => {
    setLoadingConcepts(true);
    try {
      const res = await fetch(`/api/v5000/sites/${siteId}/generate-logo-concepts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        const data = await res.json();
        setConcepts(data.concepts || []);
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to generate concepts');
      }
    } catch (error) {
      console.error('Error generating concepts:', error);
      alert('Failed to generate concepts');
    } finally {
      setLoadingConcepts(false);
    }
  };

  const handleSelectConcept = async (concept: LogoConcept) => {
    setSelectedConcept(concept);
    setGenerating(true);
    try {
      const res = await fetch(`/api/v5000/sites/${siteId}/generate-logo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customPrompt: concept.prompt,
        }),
      });

      if (res.ok) {
        onLogoUpdate();
        setSelectedConcept(null);
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to generate logo');
        setSelectedConcept(null);
      }
    } catch (error) {
      console.error('Error generating logo:', error);
      alert('Failed to generate logo');
      setSelectedConcept(null);
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateFromPrompt = async () => {
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

      {/* Concept Generation Section */}
      {concepts.length === 0 && !loadingConcepts && !generating && (
        <div style={{ marginBottom: '1.5rem' }}>
          <button
            onClick={handleGenerateConcepts}
            disabled={loadingConcepts}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: loadingConcepts ? '#ccc' : '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loadingConcepts ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: '500',
              width: '100%',
            }}
          >
            {loadingConcepts ? 'Creating Concepts...' : 'Generate Logo Concepts'}
          </button>
          <small style={{ color: '#666', fontSize: '0.875rem', display: 'block', marginTop: '0.5rem', textAlign: 'center' }}>
            AI will create 3-5 professional logo concepts for you to choose from
          </small>
        </div>
      )}

      {/* Loading Concepts */}
      {loadingConcepts && (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          color: '#666',
          marginBottom: '1rem'
        }}>
          Creating logo concepts...
        </div>
      )}

      {/* Concept Cards */}
      {concepts.length > 0 && !generating && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.1rem' }}>Choose a Logo Concept:</h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '1rem'
          }}>
            {concepts.map((concept, index) => (
              <div
                key={index}
                onClick={() => handleSelectConcept(concept)}
                style={{
                  border: selectedConcept === concept ? '2px solid #0070f3' : '1px solid #ddd',
                  borderRadius: '8px',
                  padding: '1rem',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: selectedConcept === concept ? '0 2px 8px rgba(0,112,243,0.2)' : '0 1px 3px rgba(0,0,0,0.1)',
                }}
                onMouseEnter={(e) => {
                  if (selectedConcept !== concept) {
                    e.currentTarget.style.borderColor = '#0070f3';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,112,243,0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedConcept !== concept) {
                    e.currentTarget.style.borderColor = '#ddd';
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                  }
                }}
              >
                <h4 style={{ marginTop: 0, marginBottom: '0.5rem', color: '#0070f3', fontSize: '1rem' }}>
                  {concept.name}
                </h4>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#666', lineHeight: '1.4' }}>
                  {concept.description}
                </p>
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              setConcepts([]);
              setSelectedConcept(null);
            }}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'transparent',
              color: '#666',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Try Different Concepts
          </button>
        </div>
      )}

      {/* Generating Logo */}
      {generating && (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          color: '#666',
          marginBottom: '1rem'
        }}>
          {selectedConcept ? `Generating "${selectedConcept.name}" logo...` : 'Generating logo...'}
        </div>
      )}

      {/* Advanced: Custom Prompt */}
      <div style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'transparent',
            color: '#666',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.875rem',
            width: '100%',
          }}
        >
          {showAdvanced ? '▼ Hide' : '▶ Show'} Advanced: Custom Prompt
        </button>
        
        {showAdvanced && (
          <div style={{ marginTop: '1rem' }}>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your DALL-E prompt here..."
              style={{
                width: '100%',
                minHeight: '150px',
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                lineHeight: '1.5',
                resize: 'vertical',
                marginBottom: '0.5rem',
              }}
            />
            <button
              onClick={handleGenerateFromPrompt}
              disabled={generating || !prompt.trim()}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: generating || !prompt.trim() ? '#ccc' : '#0070f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: generating || !prompt.trim() ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Generate from Custom Prompt
            </button>
          </div>
        )}
      </div>
      
      {logoUrl && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
          Cost: ~$0.04 per generation
        </div>
      )}
    </div>
  );
}

