/**
 * Page Editor Component
 * 
 * Inline page editor for the sidebar layout
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import ImagePicker from './ImagePicker';

interface Page {
  id: string;
  pageType: string;
  slug: string;
  titleTag: string;
  h1: string | null;
  focusKeyword: string;
  seoTitle: string | null;
  seoDescription: string | null;
  htmlDraft: string | null;
  htmlEdited: string | null;
  notesForGpt: string | null;
  status: string | null;
  wpPermalink: string | null;
  heroImageUrl?: string | null;
  heroImageAlt?: string | null;
}

interface PageEditorProps {
  siteId: string;
  pageId: string | null;
  city: string;
  state: string;
  onPageUpdate: () => void;
}

export default function PageEditor({ siteId, pageId, city, state, onPageUpdate }: PageEditorProps) {
  const router = useRouter();
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [useCustomHtml, setUseCustomHtml] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gpt-4o');
  
  // Form state
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [htmlEdited, setHtmlEdited] = useState('');
  const [notesForGpt, setNotesForGpt] = useState('');
  
  // Audit state
  const [auditing, setAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<any>(null);
  
  // Image picker state
  const [showImagePicker, setShowImagePicker] = useState(false);

  useEffect(() => {
    if (pageId) {
      fetchPage();
    } else {
      setPage(null);
    }
  }, [pageId, siteId]);

  const fetchPage = async () => {
    if (!pageId) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/v5000/sites/${siteId}`);
      if (res.ok) {
        const site = await res.json();
        const foundPage = site.pages?.find((p: any) => p.id === pageId);
        if (foundPage) {
          setPage(foundPage);
          setSeoTitle(foundPage.seoTitle || foundPage.titleTag || '');
          setSeoDescription(foundPage.seoDescription || '');
          setHtmlEdited(foundPage.htmlEdited || '');
          setNotesForGpt(foundPage.notesForGpt || '');
          setUseCustomHtml(!!foundPage.htmlEdited);
        }
      }
    } catch (error) {
      console.error('Error fetching page:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!pageId) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/page/${pageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seoTitle,
          seoDescription,
          htmlEdited: useCustomHtml ? htmlEdited : undefined,
          notesForGpt,
        }),
      });

      if (res.ok) {
        alert('Page saved successfully!');
        fetchPage();
        onPageUpdate();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to save page');
      }
    } catch (error) {
      console.error('Error saving page:', error);
      alert('Failed to save page');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async (isRegenerate: boolean = false) => {
    if (!pageId) return;
    
    if (isRegenerate && !confirm('Regenerate this page with GPT? This will overwrite the draft content.')) {
      return;
    }

    if (isRegenerate) {
      setRegenerating(true);
    } else {
      setGenerating(true);
    }

    try {
      const res = await fetch(`/api/v5000/sites/${siteId}/pages/${pageId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedModel }),
      });

      if (res.ok) {
        const result = await res.json();
        setHtmlEdited('');
        setUseCustomHtml(false);
        fetchPage();
        onPageUpdate();
        alert(`Page ${isRegenerate ? 'regenerated' : 'generated'} successfully using ${result.model || selectedModel}!`);
      } else {
        const error = await res.json();
        alert(error.error || `Failed to ${isRegenerate ? 'regenerate' : 'generate'} page`);
      }
    } catch (error) {
      console.error(`Error ${isRegenerate ? 'regenerating' : 'generating'} page:`, error);
      alert(`Failed to ${isRegenerate ? 'regenerate' : 'generate'} page`);
    } finally {
      if (isRegenerate) {
        setRegenerating(false);
      } else {
        setGenerating(false);
      }
    }
  };

  const handleAudit = async () => {
    if (!siteId || !pageId) return;
    
    setAuditing(true);
    try {
      const res = await fetch(`/api/v5000/sites/${siteId}/pages/${pageId}/audit`, {
        method: 'POST',
      });
      
      if (res.ok) {
        const result = await res.json();
        setAuditResult(result);
      } else {
        const error = await res.json();
        alert(`Audit failed: ${error.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setAuditing(false);
    }
  };

  if (!pageId) {
    return (
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: '#6c757d',
        fontSize: '1.125rem'
      }}>
        Select a page from the sidebar to edit
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading page...</div>;
  }

  if (!page) {
    return <div style={{ padding: '2rem' }}>Page not found</div>;
  }

  const displayHtml = useCustomHtml ? htmlEdited : (page.htmlEdited || page.htmlDraft || '');

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ marginBottom: '0.5rem' }}>{page.titleTag || page.slug || '(untitled)'}</h1>
        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', color: '#6c757d' }}>
          <span><strong>Type:</strong> {page.pageType}</span>
          <span><strong>Keyword:</strong> {page.focusKeyword}</span>
          <span><strong>Status:</strong> {page.status || 'draft'}</span>
          {page.wpPermalink && (
            <a href={page.wpPermalink} target="_blank" rel="noopener noreferrer" style={{ color: '#0070f3' }}>
              View Published →
            </a>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Left: Preview */}
        <div>
          <h2 style={{ marginBottom: '1rem' }}>Preview</h2>
          <div
            style={{
              border: '1px solid #ddd',
              borderRadius: '4px',
              padding: '1rem',
              minHeight: '600px',
              backgroundColor: '#fff',
              overflow: 'auto',
            }}
            dangerouslySetInnerHTML={{ __html: displayHtml }}
          />
        </div>

        {/* Right: Editor */}
        <div>
          <h2 style={{ marginBottom: '1rem' }}>Editor</h2>
          
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              SEO Title
            </label>
            <input
              type="text"
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
              }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              SEO Description
            </label>
            <textarea
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
              }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              GPT Model
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
              }}
            >
              <option value="gpt-4o">GPT-4o (Best quality, slower)</option>
              <option value="gpt-4o-mini">GPT-4o-mini (Faster, cheaper)</option>
              <option value="gpt-4-turbo">GPT-4 Turbo (Balanced)</option>
            </select>
          </div>

          {/* Hero Image Section */}
          <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label style={{ fontWeight: 'bold' }}>Hero Image</label>
              <button
                onClick={() => setShowImagePicker(true)}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#0070f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                {page.heroImageUrl ? 'Change Image' : 'Select Image'}
              </button>
            </div>
            {page.heroImageUrl ? (
              <div>
                <img
                  src={page.heroImageUrl}
                  alt={page.heroImageAlt || 'Hero image'}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '200px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    marginBottom: '0.5rem',
                  }}
                />
                {page.heroImageAlt && (
                  <div style={{ fontSize: '0.875rem', color: '#666' }}>
                    Alt: {page.heroImageAlt}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: '0.875rem', color: '#666', fontStyle: 'italic' }}>
                No hero image selected
              </div>
            )}
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Notes for GPT (used when generating/regenerating)
            </label>
            <textarea
              value={notesForGpt}
              onChange={(e) => setNotesForGpt(e.target.value)}
              rows={4}
              placeholder="Add specific instructions for GPT when generating this page..."
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
              }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={useCustomHtml}
                onChange={(e) => setUseCustomHtml(e.target.checked)}
              />
              Use custom HTML instead of AI-generated HTML
            </label>
          </div>

          {useCustomHtml && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Custom HTML
              </label>
              <textarea
                value={htmlEdited}
                onChange={(e) => setHtmlEdited(e.target.value)}
                rows={20}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                }}
              />
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', flexWrap: 'wrap' }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: saving ? '#ccc' : '#0070f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
              }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>

            {!page.htmlDraft && (
              <button
                onClick={() => handleGenerate(false)}
                disabled={generating}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: generating ? '#ccc' : '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: generating ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                }}
              >
                {generating ? 'Generating...' : 'Generate Content'}
              </button>
            )}

            {page.htmlDraft && (
              <button
                onClick={() => handleGenerate(true)}
                disabled={regenerating}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: regenerating ? '#ccc' : '#ffc107',
                  color: '#000',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: regenerating ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                }}
              >
                {regenerating ? 'Regenerating...' : 'Regenerate'}
              </button>
            )}

            <button
              onClick={handleAudit}
              disabled={auditing}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: auditing ? '#ccc' : '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: auditing ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
              }}
            >
              {auditing ? 'Auditing...' : 'Run SEO Audit'}
            </button>
          </div>

          {/* Audit Results */}
          {auditResult && (
            <div style={{
              marginTop: '2rem',
              padding: '1rem',
              backgroundColor: '#f8f9fa',
              borderRadius: '4px',
              border: '1px solid #dee2e6'
            }}>
              <h3 style={{ marginTop: 0 }}>SEO Audit Results</h3>
              <div style={{ marginBottom: '0.5rem' }}>
                <strong>Status:</strong> {auditResult.overallStatus}
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <strong>Quality Score:</strong> {auditResult.scores?.quality?.toFixed(0) || 'N/A'}/100
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <strong>Issues:</strong> {auditResult.issues?.length || 0}
              </div>
              {auditResult.issues && auditResult.issues.length > 0 && (
                <div>
                  <strong>Issues:</strong>
                  <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                    {auditResult.issues.slice(0, 5).map((issue: any, idx: number) => (
                      <li key={idx} style={{ marginBottom: '0.25rem' }}>
                        <span style={{ 
                          padding: '0.125rem 0.5rem',
                          borderRadius: '3px',
                          backgroundColor: issue.severity === 'high' ? '#dc3545' : issue.severity === 'medium' ? '#ffc107' : '#6c757d',
                          color: 'white',
                          fontSize: '0.75rem',
                          marginRight: '0.5rem'
                        }}>
                          {issue.severity}
                        </span>
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Image Picker Modal */}
      {showImagePicker && page && (
        <ImagePicker
          siteId={siteId}
          pageId={page.id}
          focusKeyword={page.focusKeyword}
          city={city}
          state={state}
          currentImageUrl={page.heroImageUrl}
          onClose={() => setShowImagePicker(false)}
          onSelect={() => {
            fetchPage();
            onPageUpdate();
          }}
        />
      )}
    </div>
  );
}

