/**
 * Add Page Modal Component
 * 
 * Modal for creating a new page with page type selection
 */

import { useState } from 'react';
import { PageType } from '@prisma/client';

interface AddPageModalProps {
  siteId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddPageModal({ siteId, onClose, onSuccess }: AddPageModalProps) {
  const [pageType, setPageType] = useState<PageType>(PageType.CORE_SERVICE);
  const [focusKeyword, setFocusKeyword] = useState('');
  const [slug, setSlug] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!pageType) {
      alert('Please select a page type');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch(`/api/v5000/sites/${siteId}/pages/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageType,
          focusKeyword: focusKeyword.trim() || undefined,
          slug: slug.trim() || undefined,
        }),
      });

      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to create page');
      }
    } catch (error) {
      console.error('Error creating page:', error);
      alert('Failed to create page');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}
    onClick={onClose}
    >
      <div style={{
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '8px',
        maxWidth: '500px',
        width: '90%'
      }}
      onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0 }}>Add New Page</h2>
        
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Page Type *
          </label>
          <select
            value={pageType}
            onChange={(e) => setPageType(e.target.value as PageType)}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '1rem'
            }}
          >
            <option value={PageType.HOME}>Home</option>
            <option value={PageType.CORE_SERVICE}>Core Service</option>
            <option value={PageType.SUPPORT}>Support</option>
            <option value={PageType.CITY}>City</option>
            <option value={PageType.ABOUT}>About</option>
            <option value={PageType.CONTACT}>Contact</option>
            <option value={PageType.LEGAL}>Legal</option>
          </select>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Focus Keyword (optional)
          </label>
          <input
            type="text"
            value={focusKeyword}
            onChange={(e) => setFocusKeyword(e.target.value)}
            placeholder="e.g., AC repair in Tampa"
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
            }}
          />
          <small style={{ color: '#666', fontSize: '0.875rem' }}>
            Primary keyword for this page. If empty, will use page type.
          </small>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Slug (optional)
          </label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="e.g., ac-repair-tampa"
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
            }}
          />
          <small style={{ color: '#666', fontSize: '0.875rem' }}>
            URL slug. If empty, will be auto-generated from keyword or page type.
          </small>
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem 1rem',
              cursor: 'pointer',
              border: '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: 'white'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: creating ? '#ccc' : '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: creating ? 'not-allowed' : 'pointer'
            }}
          >
            {creating ? 'Creating...' : 'Create Page'}
          </button>
        </div>
      </div>
    </div>
  );
}

