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
  const [selectedPhotos, setSelectedPhotos] = useState<UnsplashPhoto[]>([]);
  const [saving, setSaving] = useState(false);
  const [customAltText, setCustomAltText] = useState('');
  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([]);

  // Fetch suggested keywords and initial search on mount
  useEffect(() => {
    const fetchSuggestions = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/v5000/sites/${siteId}/pages/${pageId}/search-images?suggestionsOnly=true`
        );
        if (res.ok) {
          const data = await res.json();
          const suggestions = data.suggestedKeywords || [];
          setSuggestedKeywords(suggestions);
          
          // Auto-search with first suggestion
          if (suggestions.length > 0) {
            setSearchQuery(suggestions[0]);
            handleSearch(suggestions[0]);
          }
        }
      } catch (error) {
        console.error('Error fetching suggestions:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSuggestions();
  }, [siteId, pageId]);

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

  const togglePhotoSelection = (photo: UnsplashPhoto) => {
    setSelectedPhotos(prev => {
      const isSelected = prev.some(p => p.id === photo.id);
      if (isSelected) {
        return prev.filter(p => p.id !== photo.id);
      } else {
        // Limit to 3 images
        if (prev.length >= 3) {
          alert('Maximum 3 images per page');
          return prev;
        }
        return [...prev, photo];
      }
    });
  };

  const handleSelect = async () => {
    if (selectedPhotos.length === 0) {
      alert('Please select at least one image');
      return;
    }

    setSaving(true);
    try {
      // Save the first selected image as the primary hero image
      const primaryPhoto = selectedPhotos[0];
      const res = await fetch(`/api/v5000/sites/${siteId}/pages/${pageId}/set-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: primaryPhoto.urls.regular,
          altText: customAltText.trim() || undefined,
          // Include all selected images for future multi-image support
          additionalImages: selectedPhotos.slice(1).map(p => ({
            url: p.urls.regular,
            alt: p.alt_description || p.description || '',
          })),
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

        {/* Suggested Keywords */}
        {suggestedKeywords.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>
              Suggested searches:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {suggestedKeywords.map((keyword, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setSearchQuery(keyword);
                    handleSearch(keyword);
                  }}
                  style={{
                    padding: '0.375rem 0.75rem',
                    backgroundColor: searchQuery === keyword ? '#0070f3' : '#f0f0f0',
                    color: searchQuery === keyword ? 'white' : '#333',
                    border: 'none',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    transition: 'all 0.2s',
                  }}
                >
                  {keyword}
                </button>
              ))}
            </div>
          </div>
        )}

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

        {/* Selection Info */}
        {selectedPhotos.length > 0 && (
          <div style={{
            marginBottom: '1rem',
            padding: '0.75rem',
            backgroundColor: '#e8f4fd',
            borderRadius: '4px',
            fontSize: '0.875rem',
            color: '#0070f3',
          }}>
            {selectedPhotos.length} image{selectedPhotos.length > 1 ? 's' : ''} selected (max 3)
          </div>
        )}

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
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: '1rem',
                marginBottom: '1.5rem',
              }}
            >
              {photos.map((photo) => {
                const isSelected = selectedPhotos.some(p => p.id === photo.id);
                const selectionIndex = selectedPhotos.findIndex(p => p.id === photo.id);
                return (
                  <div
                    key={photo.id}
                    onClick={() => togglePhotoSelection(photo)}
                    style={{
                      position: 'relative',
                      cursor: 'pointer',
                      border: isSelected ? '3px solid #0070f3' : '1px solid #ddd',
                      borderRadius: '4px',
                      overflow: 'hidden',
                      backgroundColor: '#f8f9fa',
                      transition: 'all 0.2s',
                    }}
                  >
                    <img
                      src={photo.urls.small}
                      alt={photo.alt_description || photo.description || 'Stock photo'}
                      style={{
                        width: '100%',
                        height: '140px',
                        objectFit: 'cover',
                      }}
                    />
                    {isSelected && (
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
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                        }}
                      >
                        {selectionIndex + 1}
                      </div>
                    )}
                    <div style={{
                      padding: '0.5rem',
                      fontSize: '0.75rem',
                      color: '#666',
                      backgroundColor: 'white',
                      borderTop: '1px solid #eee',
                    }}>
                      by {photo.user.name}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Custom Alt Text */}
            {selectedPhotos.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Primary Image Alt Text (optional)
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
                disabled={selectedPhotos.length === 0 || saving}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: selectedPhotos.length === 0 || saving ? '#ccc' : '#0070f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: selectedPhotos.length === 0 || saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Saving...' : `Select ${selectedPhotos.length} Image${selectedPhotos.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

