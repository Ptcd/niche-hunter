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
  const [useCustomHtml, setUseCustomHtml] = useState(false);
  
  // Form state
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [htmlEdited, setHtmlEdited] = useState('');
  const [notesForGpt, setNotesForGpt] = useState('');

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

  const handleRegenerate = async () => {
    if (!pageId || typeof pageId !== 'string') return;
    if (!confirm('Regenerate this page with GPT? This will overwrite the draft content.')) {
      return;
    }

    setRegenerating(true);
    try {
      const res = await fetch('/api/page/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId }),
      });

      if (res.ok) {
        const result = await res.json();
        setHtmlEdited(''); // Clear edited version
        setUseCustomHtml(false);
        fetchPage();
        alert('Page regenerated successfully!');
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to regenerate page');
      }
    } catch (error) {
      console.error('Error regenerating page:', error);
      alert('Failed to regenerate page');
    } finally {
      setRegenerating(false);
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
              Notes for GPT (used when regenerating)
            </label>
            <textarea
              value={notesForGpt}
              onChange={(e) => setNotesForGpt(e.target.value)}
              rows={4}
              placeholder="Add specific instructions for GPT when regenerating this page..."
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

          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
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

            <button
              onClick={handleRegenerate}
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
          </div>
        </div>
      </div>
    </div>
  );
}

