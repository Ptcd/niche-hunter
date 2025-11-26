/**
 * Site Setup Wizard
 * 
 * Page for configuring domain, phone, and WordPress URL before generating assets.
 */

import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

interface Site {
  id: string;
  niche: { name: string; slug: string };
  city: string;
  state: string;
  leadValue: number;
  status: string;
}

export default function SiteSetupPage() {
  const router = useRouter();
  const { siteId } = router.query;
  const [site, setSite] = useState<Site | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchingNumbers, setSearchingNumbers] = useState(false);
  const [availableNumbers, setAvailableNumbers] = useState<Array<{ phoneNumber: string; friendlyName: string }>>([]);

  const [formData, setFormData] = useState({
    domain: '',
    phoneNumber: '',
    wpBaseUrl: '',
  });

  useEffect(() => {
    if (siteId && typeof siteId === 'string') {
      fetchSite();
    }
  }, [siteId]);

  const fetchSite = async () => {
    try {
      const res = await fetch(`/api/v5000/sites/${siteId}`);
      if (res.ok) {
        const data = await res.json();
        setSite(data);
        setFormData(prev => ({
          ...prev,
          wpBaseUrl: data.wpBaseUrl || `https://${data.domain || ''}`,
        }));
      }
    } catch (error) {
      console.error('Error fetching site:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchNumbers = async () => {
    if (!site) return;
    
    setSearchingNumbers(true);
    try {
      const res = await fetch(`/api/v5000/twilio/numbers/search?state=${site.state}`);
      if (res.ok) {
        const data = await res.json();
        setAvailableNumbers(data.numbers || []);
      }
    } catch (error) {
      console.error('Error searching numbers:', error);
      alert('Failed to search phone numbers');
    } finally {
      setSearchingNumbers(false);
    }
  };

  const handlePurchaseNumber = async (phoneNumber: string) => {
    try {
      const res = await fetch('/api/v5000/twilio/numbers/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });

      if (res.ok) {
        const data = await res.json();
        setFormData(prev => ({ ...prev, phoneNumber: data.phoneNumber }));
        setAvailableNumbers([]);
        alert('Phone number purchased successfully!');
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to purchase number');
      }
    } catch (error) {
      console.error('Error purchasing number:', error);
      alert('Failed to purchase phone number');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.domain || !formData.phoneNumber || !formData.wpBaseUrl) {
      alert('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/v5000/sites/${siteId}/setup`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        // Redirect to site detail page
        router.push(`/v5000/sites/${siteId}`);
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to setup site');
      }
    } catch (error) {
      console.error('Error setting up site:', error);
      alert('Failed to setup site');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem' }}>Loading...</div>;
  }

  if (!site) {
    return <div style={{ padding: '2rem' }}>Site not found</div>;
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Site Setup: {site.niche.name} - {site.city}, {site.state}</h1>
      
      <div style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
        <h3>Site Summary</h3>
        <p><strong>Niche:</strong> {site.niche.name}</p>
        <p><strong>Location:</strong> {site.city}, {site.state}</p>
        <p><strong>Lead Value:</strong> ${site.leadValue.toFixed(2)}/lead</p>
        <p><strong>Status:</strong> {site.status}</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Domain *
          </label>
          <input
            type="text"
            value={formData.domain}
            onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
            placeholder="wesleychapelhvac.com"
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
            required
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Phone Number *
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="text"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              placeholder="+1XXX"
              style={{
                flex: 1,
                padding: '0.5rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
              }}
              required
            />
            <button
              type="button"
              onClick={handleSearchNumbers}
              disabled={searchingNumbers}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: searchingNumbers ? '#6c757d' : '#17a2b8',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: searchingNumbers ? 'not-allowed' : 'pointer',
              }}
            >
              {searchingNumbers ? 'Searching...' : 'Get from Twilio'}
            </button>
          </div>
          
          {availableNumbers.length > 0 && (
            <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '4px' }}>
              <p style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Available Numbers:</p>
              {availableNumbers.map((num) => (
                <div key={num.phoneNumber} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', borderBottom: '1px solid #eee' }}>
                  <span>{num.phoneNumber}</span>
                  <button
                    type="button"
                    onClick={() => handlePurchaseNumber(num.phoneNumber)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Purchase
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            WordPress Base URL *
          </label>
          <input
            type="text"
            value={formData.wpBaseUrl}
            onChange={(e) => setFormData({ ...formData, wpBaseUrl: e.target.value })}
            placeholder="https://wesleychapelhvac.com"
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
            required
          />
          <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
            Set up your WordPress site in Hostinger first, then enter the URL here.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: '0.75rem 2rem',
              backgroundColor: submitting ? '#6c757d' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
            }}
          >
            {submitting ? 'Creating Assets...' : 'Create Assets'}
          </button>
          <button
            type="button"
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
      </form>
    </div>
  );
}


