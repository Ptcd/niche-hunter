/**
 * Page Editor
 * 
 * Edit page content, SEO fields, and regenerate with GPT.
 */

import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

interface Page {
  id: string;
  pageType: string;
  slug: string;
  titleTag: string;
  h1: string;
  focusKeyword: string;
  seoTitle: string | null;
  seoDescription: string | null;
  htmlDraft: string | null;
  htmlEdited: string | null;
  notesForGpt: string | null;
  status: string | null;
}

export default function PageEditor() {
  const router = useRouter();
  const { siteId, pageId } = router.query;
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [useCustomHtml, setUseCustomHtml] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gpt-4o');
  const [lastModelUsed, setLastModelUsed] = useState<string | null>(null);
  
  // Form state
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [htmlEdited, setHtmlEdited] = useState('');
  const [notesForGpt, setNotesForGpt] = useState('');
  
  // Audit state
  const [auditing, setAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<any>(null);

  useEffect(() => {
    if (pageId && typeof pageId === 'string') {
      fetchPage();
    }
  }, [pageId]);

  const fetchPage = async () => {
    try {
      // Load page from site's pages (would need a dedicated API endpoint)
      // For now, we'll use a placeholder
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
    if (!pageId || typeof pageId !== 'string') return;

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
    if (!pageId || typeof pageId !== 'string' || !siteId || typeof siteId !== 'string') return;
    
    if (isRegenerate && !confirm('Regenerate this page with GPT? This will overwrite the draft content.')) {
      return;
    }

    const isGenerating = isRegenerate ? false : true;
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
        setHtmlEdited(''); // Clear edited version
        setUseCustomHtml(false);
        setLastModelUsed(result.model || selectedModel);
        fetchPage();
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

  const handleApprove = async () => {
    if (!pageId || typeof pageId !== 'string') return;

    try {
      const res = await fetch(`/api/page/${pageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });

      if (res.ok) {
        alert('Page approved!');
        fetchPage();
      } else {
        alert('Failed to approve page');
      }
    } catch (error) {
      console.error('Error approving page:', error);
      alert('Failed to approve page');
    }
  };

  const handleAudit = async () => {
    if (!siteId || !pageId || typeof siteId !== 'string' || typeof pageId !== 'string') return;
    
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

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  if (!page) {
    return <div style={{ padding: '2rem' }}>Page not found</div>;
  }

  const displayHtml = useCustomHtml ? htmlEdited : (page.htmlEdited || page.htmlDraft || '');

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <button
          onClick={() => router.push(`/sites/${siteId}`)}
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
          ← Back to Site
        </button>
        <h1>Edit Page: {page.slug || '(home)'}</h1>
        <p><strong>Type:</strong> {page.pageType} | <strong>Keyword:</strong> {page.focusKeyword} | <strong>Status:</strong> {page.status || 'draft'}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Left: Preview */}
        <div>
          <h2>Preview</h2>
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
          <h2>Editor</h2>
          
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
            {lastModelUsed && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
                Last used: {lastModelUsed}
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
                  color: 'black',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: regenerating ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                }}
              >
                {regenerating ? 'Regenerating...' : 'Regenerate with GPT'}
              </button>
            )}

            <button
              onClick={handleApprove}
              disabled={page.status === 'APPROVED'}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: page.status === 'APPROVED' ? '#ccc' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: page.status === 'APPROVED' ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
              }}
            >
              {page.status === 'APPROVED' ? 'Already Approved' : 'Mark as Approved'}
            </button>

            <button
              onClick={handleAudit}
              disabled={auditing}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: auditing ? '#ccc' : '#17a2b8',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: auditing ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
                marginLeft: '0.5rem',
              }}
            >
              {auditing ? 'Auditing...' : 'Run SEO Audit'}
            </button>
          </div>
        </div>

        {/* Audit Results */}
        {auditResult && (
          <div style={{ marginTop: '2rem', border: '1px solid #ddd', borderRadius: '8px', padding: '1.5rem' }}>
            <h2 style={{ marginTop: 0 }}>SEO Audit Results</h2>
            
            {/* Overall Status */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>Overall Status:</span>
                <span
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '4px',
                    fontWeight: 'bold',
                    backgroundColor:
                      auditResult.overallStatus === 'ELITE' ? '#28a745' :
                      auditResult.overallStatus === 'STRONG' ? '#17a2b8' :
                      auditResult.overallStatus === 'NEEDS_WORK' ? '#ffc107' :
                      '#dc3545',
                    color: 'white',
                  }}
                >
                  {auditResult.overallStatus}
                </span>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <strong>Quality Score:</strong> {auditResult.scores.quality}/100
                </div>
                <div>
                  <strong>Competitive Edge:</strong> {auditResult.scores.competitiveEdge}/100
                </div>
              </div>
            </div>

            {/* Hard Gates */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ marginBottom: '0.5rem' }}>Hard Gates</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                {Object.entries(auditResult.hardGates).map(([gate, status]) => {
                  const gateStatus = status as 'PASS' | 'WARN' | 'FAIL';
                  return (
                    <div key={gate} style={{ padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}>
                      <div style={{ fontSize: '0.875rem', color: '#666' }}>{gate.replace('G', 'Gate ')}</div>
                      <div
                        style={{
                          fontWeight: 'bold',
                          color:
                            gateStatus === 'PASS' ? '#28a745' :
                            gateStatus === 'WARN' ? '#ffc107' :
                            '#dc3545',
                        }}
                      >
                        {gateStatus}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Priority Issues */}
            {auditResult.issues && auditResult.issues.length > 0 && (
              <div>
                <h3 style={{ marginBottom: '0.5rem' }}>Priority Issues ({auditResult.issues.length})</h3>
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {auditResult.issues.map((issue: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        marginBottom: '1rem',
                        padding: '1rem',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        borderLeft: `4px solid ${
                          issue.severity === 'high' ? '#dc3545' :
                          issue.severity === 'medium' ? '#ffc107' :
                          '#17a2b8'
                        }`,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontWeight: 'bold' }}>{issue.id}</span>
                        <span
                          style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.875rem',
                            backgroundColor:
                              issue.severity === 'high' ? '#dc3545' :
                              issue.severity === 'medium' ? '#ffc107' :
                              '#17a2b8',
                            color: 'white',
                          }}
                        >
                          {issue.severity}
                        </span>
                      </div>
                      <div style={{ marginBottom: '0.5rem', color: '#666' }}>{issue.message}</div>
                      <div style={{ padding: '0.5rem', backgroundColor: '#f8f9fa', borderRadius: '4px', fontSize: '0.875rem' }}>
                        <strong>Fix:</strong> {issue.suggestedAction}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


