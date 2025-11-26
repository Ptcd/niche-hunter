/**
 * Content Writer Config Page
 * 
 * Configure GPT prompts and style for content generation per niche.
 */

import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

interface WriterConfig {
  systemPrompt: string | null;
  tone: string | null;
  styleRules: string | null;
  brandVoice: string | null;
  terminology: string | null;
  thingsToAvoid: string | null;
  externalLinkDomains: string[];
}

export default function ContentWriterConfigPage() {
  const router = useRouter();
  const { nicheId } = router.query;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<WriterConfig>({
    systemPrompt: null,
    tone: null,
    styleRules: null,
    brandVoice: null,
    terminology: null,
    thingsToAvoid: null,
    externalLinkDomains: [],
  });
  const [externalDomainInput, setExternalDomainInput] = useState('');

  useEffect(() => {
    if (nicheId && typeof nicheId === 'string') {
      fetchConfig();
    }
  }, [nicheId]);

  const fetchConfig = async () => {
    try {
      const res = await fetch(`/api/v5000/niches/${nicheId}/writer-config`);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setConfig(data);
        }
      }
    } catch (error) {
      console.error('Error fetching config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/v5000/niches/${nicheId}/writer-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (res.ok) {
        alert('Configuration saved successfully!');
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to save configuration');
      }
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleAddDomain = () => {
    if (externalDomainInput.trim()) {
      setConfig({
        ...config,
        externalLinkDomains: [...config.externalLinkDomains, externalDomainInput.trim()],
      });
      setExternalDomainInput('');
    }
  };

  const handleRemoveDomain = (domain: string) => {
    setConfig({
      ...config,
      externalLinkDomains: config.externalLinkDomains.filter(d => d !== domain),
    });
  };

  if (loading) {
    return <div style={{ padding: '2rem' }}>Loading...</div>;
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <h1>Content Writer Configuration</h1>
      
      <div style={{ marginBottom: '2rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          System Prompt
        </label>
        <textarea
          value={config.systemPrompt || ''}
          onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
          placeholder="Base instructions for GPT (e.g., 'You are a local SEO expert...')"
          rows={4}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontFamily: 'monospace',
          }}
        />
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          Tone
        </label>
        <select
          value={config.tone || ''}
          onChange={(e) => setConfig({ ...config, tone: e.target.value })}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid #ccc',
            borderRadius: '4px',
          }}
        >
          <option value="">Select tone...</option>
          <option value="professional">Professional</option>
          <option value="conversational">Conversational</option>
          <option value="urgent">Urgent</option>
          <option value="friendly">Friendly</option>
        </select>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          Style Rules
        </label>
        <textarea
          value={config.styleRules || ''}
          onChange={(e) => setConfig({ ...config, styleRules: e.target.value })}
          placeholder="Custom style instructions (e.g., 'Use short sentences', 'Avoid jargon')"
          rows={3}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid #ccc',
            borderRadius: '4px',
          }}
        />
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          Brand Voice
        </label>
        <textarea
          value={config.brandVoice || ''}
          onChange={(e) => setConfig({ ...config, brandVoice: e.target.value })}
          placeholder="Describe your brand voice (e.g., 'Helpful, trustworthy, local expert')"
          rows={2}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid #ccc',
            borderRadius: '4px',
          }}
        />
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          Preferred Terminology
        </label>
        <textarea
          value={config.terminology || ''}
          onChange={(e) => setConfig({ ...config, terminology: e.target.value })}
          placeholder="Preferred terms and phrases (e.g., 'HVAC system' not 'air conditioner unit')"
          rows={2}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid #ccc',
            borderRadius: '4px',
          }}
        />
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          Things to Avoid
        </label>
        <textarea
          value={config.thingsToAvoid || ''}
          onChange={(e) => setConfig({ ...config, thingsToAvoid: e.target.value })}
          placeholder="Things to avoid in content (e.g., 'No salesy language', 'No false promises')"
          rows={2}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid #ccc',
            borderRadius: '4px',
          }}
        />
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          External Link Domains (Whitelist)
        </label>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <input
            type="text"
            value={externalDomainInput}
            onChange={(e) => setExternalDomainInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddDomain()}
            placeholder="e.g., energy.gov"
            style={{
              flex: 1,
              padding: '0.5rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          />
          <button
            onClick={handleAddDomain}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Add
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {config.externalLinkDomains.map((domain) => (
            <span
              key={domain}
              style={{
                padding: '0.25rem 0.5rem',
                backgroundColor: '#e9ecef',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              {domain}
              <button
                onClick={() => handleRemoveDomain(domain)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#dc3545',
                  fontSize: '1.2rem',
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '0.75rem 2rem',
            backgroundColor: saving ? '#6c757d' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
          }}
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
        <button
          onClick={() => router.back()}
          style={{
            padding: '0.75rem 2rem',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}


