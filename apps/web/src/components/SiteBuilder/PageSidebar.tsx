/**
 * Page Sidebar Component
 * 
 * Displays list of pages with status indicators and allows navigation between pages
 */

import { useState } from 'react';

export interface PageSidebarPage {
  id: string;
  pageType: string;
  slug: string;
  titleTag: string;
  focusKeyword: string;
  status: string | null;
  wpPermalink: string | null;
  latestPublishedAt: string | null;
}

interface PageSidebarProps {
  pages: PageSidebarPage[];
  selectedPageId: string | null;
  onSelectPage: (pageId: string) => void;
  onAddPage: () => void;
}

export default function PageSidebar({ pages, selectedPageId, onSelectPage, onAddPage }: PageSidebarProps) {
  const getStatusColor = (status: string | null) => {
    if (status === 'APPROVED') return '#28a745';
    if (status === 'PUBLISHED') return '#0070f3';
    return '#ffc107';
  };

  const getStatusLabel = (status: string | null) => {
    return status || 'draft';
  };

  return (
    <div style={{
      width: '250px',
      backgroundColor: '#f8f9fa',
      borderRight: '1px solid #dee2e6',
      height: '100vh',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        padding: '1rem',
        borderBottom: '1px solid #dee2e6',
        backgroundColor: 'white'
      }}>
        <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: '600' }}>Pages</h3>
        <button
          onClick={onAddPage}
          style={{
            width: '100%',
            padding: '0.5rem',
            backgroundColor: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: '500'
          }}
        >
          + Add Page
        </button>
      </div>

      {/* Page List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {pages.length === 0 ? (
          <div style={{ padding: '1rem', textAlign: 'center', color: '#6c757d', fontSize: '0.875rem' }}>
            No pages yet. Click "Add Page" to create one.
          </div>
        ) : (
          pages.map((page) => (
            <div
              key={page.id}
              onClick={() => onSelectPage(page.id)}
              style={{
                padding: '0.75rem 1rem',
                cursor: 'pointer',
                borderBottom: '1px solid #e9ecef',
                backgroundColor: selectedPageId === page.id ? '#e7f3ff' : 'white',
                borderLeft: selectedPageId === page.id ? '3px solid #0070f3' : '3px solid transparent',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (selectedPageId !== page.id) {
                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedPageId !== page.id) {
                  e.currentTarget.style.backgroundColor = 'white';
                }
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '0.25rem'
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: selectedPageId === page.id ? '#0070f3' : '#212529',
                    marginBottom: '0.25rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {page.titleTag || page.focusKeyword || page.slug || '(untitled)'}
                  </div>
                  <div style={{
                    fontSize: '0.75rem',
                    color: '#6c757d',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {page.pageType} • {page.slug || '(home)'}
                  </div>
                </div>
              </div>
              
              <div style={{
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'center',
                marginTop: '0.5rem'
              }}>
                <span style={{
                  padding: '0.125rem 0.5rem',
                  borderRadius: '3px',
                  backgroundColor: getStatusColor(page.status),
                  color: 'white',
                  fontSize: '0.7rem',
                  fontWeight: '500'
                }}>
                  {getStatusLabel(page.status)}
                </span>
                {page.wpPermalink && (
                  <span style={{
                    fontSize: '0.7rem',
                    color: '#28a745'
                  }} title="Published">
                    ✓
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

