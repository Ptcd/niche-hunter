/**
 * Image Picker Component
 * 
 * Modal for selecting images from Unsplash
 */

import { useState, useEffect } from 'react';

interface UnsplashPhoto {
  id: string;
  urls: {
    regular: string;
    small: string;
    thumb: string;
  };
  alt_description: string | null;
  description: string | null;
  user: {
    name: string;
    username: string;
  };
}

interface ImagePickerProps {
  siteId: string;
  pageId: string;
  focusKeyword: string;
  city: string;
  state: string;
  currentImageUrl: string | null;
  onClose: () => void;
  onSelect: () => void;
}

export default function ImagePicker({
  siteId,
  pageId,
  focusKeyword,
  city,
  state,
  currentImageUrl,
  onClose,
  onSelect,
}: ImagePickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [photos, setPhotos] = useState<UnsplashPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<UnsplashPhoto | null>(null);
  const [saving, setSaving] = useState(false);
  const [customAltText, setCustomAltText] = useState('');

  // Auto-search on mount
  useEffect(() => {
    const defaultQuery = `${focusKeyword} ${city}`;
    setSearchQuery(defaultQuery);
    handleSearch(defaultQuery);
  }, []);

  const handleSearch = async (query?: string) => {
    const searchTerm = query || searchQuery;
    if (!searchTerm.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(
        `/api/v5000/sites/${siteId}/pages/${pageId}/search-images?query=${encodeURIComponent(searchTerm)}&perPage=8`
      );
      if (res.ok) {
        const data = await res.json();
        setPhotos(data.photos || []);
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to search images');
      }
    } catch (error) {
      console.error('Error searching images:', error);
      alert('Failed to search images');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async () => {
    if (!selectedPhoto) {
      alert('Please select an image');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/v5000/sites/${siteId}/pages/${pageId}/set-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: selectedPhoto.urls.regular,
          altText: customAltText.trim() || undefined,
        }),
      });

      if (res.ok) {
        onSelect();
        onClose();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to set image');
      }
    } catch (error) {
      console.error('Error setting image:', error);
      alert('Failed to set image');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '2rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '2rem',
          maxWidth: '900px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0 }}>Select Hero Image</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#666',
            }}
          >
            ×
          </button>
        </div>

        {/* Search */}
        <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }}
            placeholder="Search for images..."
            style={{
              flex: 1,
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
            }}
          />
          <button
            onClick={() => handleSearch()}
            disabled={loading}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: loading ? '#ccc' : '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {/* Current Image */}
        {currentImageUrl && (
          <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Current Image:</div>
            <img
              src={currentImageUrl}
              alt="Current hero image"
              style={{
                maxWidth: '200px',
                maxHeight: '150px',
                border: '1px solid #ddd',
                borderRadius: '4px',
              }}
            />
          </div>
        )}

        {/* Image Grid */}
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>Loading images...</div>
        ) : photos.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
            No images found. Try a different search term.
          </div>
        ) : (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '1rem',
                marginBottom: '1.5rem',
              }}
            >
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  onClick={() => setSelectedPhoto(photo)}
                  style={{
                    position: 'relative',
                    cursor: 'pointer',
                    border: selectedPhoto?.id === photo.id ? '3px solid #0070f3' : '1px solid #ddd',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    backgroundColor: '#f8f9fa',
                  }}
                >
                  <img
                    src={photo.urls.small}
                    alt={photo.alt_description || photo.description || 'Stock photo'}
                    style={{
                      width: '100%',
                      height: '150px',
                      objectFit: 'cover',
                    }}
                  />
                  {selectedPhoto?.id === photo.id && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '0.5rem',
                        right: '0.5rem',
                        backgroundColor: '#0070f3',
                        color: 'white',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.875rem',
                        fontWeight: 'bold',
                      }}
                    >
                      ✓
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Custom Alt Text */}
            {selectedPhoto && (
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Alt Text (optional - auto-generated if empty)
                </label>
                <input
                  type="text"
                  value={customAltText}
                  onChange={(e) => setCustomAltText(e.target.value)}
                  placeholder="Auto-generated based on keyword and location"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                  }}
                />
                <small style={{ color: '#666', fontSize: '0.875rem', display: 'block', marginTop: '0.25rem' }}>
                  SEO-optimized alt text will be generated automatically if left empty
                </small>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={onClose}
                style={{
                  padding: '0.5rem 1rem',
                  cursor: 'pointer',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSelect}
                disabled={!selectedPhoto || saving}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: !selectedPhoto || saving ? '#ccc' : '#0070f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: !selectedPhoto || saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Saving...' : 'Select Image'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

