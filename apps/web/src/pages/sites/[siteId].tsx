/**
 * Site Factory Detail Page
 * 
 * Shows site setup, pages table, and actions for building/publishing.
 */

import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import CitationsPanel from '@/components/SiteFactory/CitationsPanel';

// Leads Panel Component
function LeadsPanel({ siteId }: { siteId: string }) {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/v5000/sites/${siteId}/leads`)
      .then(res => res.json())
      .then(data => {
        setLeads(data.leads || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [siteId]);

  if (loading) {
    return <div style={{ padding: '1rem' }}>Loading leads...</div>;
  }

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '1.5rem', marginBottom: '2rem' }}>
      <h2 style={{ marginTop: 0 }}>Recent Leads ({leads.length})</h2>
      {leads.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
          No leads yet. Leads will appear here when forms are submitted or calls are tracked.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd' }}>
              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Type</th>
              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Contact</th>
              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Date</th>
              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Source</th>
            </tr>
          </thead>
          <tbody>
            {leads.slice(0, 10).map((lead) => (
              <tr key={lead.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.75rem' }}>
                  <span style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    backgroundColor: lead.type === 'CALL' ? '#0070f3' : '#28a745',
                    color: 'white',
                    fontSize: '0.875rem',
                  }}>
                    {lead.type}
                  </span>
                </td>
                <td style={{ padding: '0.75rem' }}>
                  {lead.contactName && <div>{lead.contactName}</div>}
                  {lead.contactPhone && <div style={{ fontSize: '0.875rem', color: '#666' }}>{lead.contactPhone}</div>}
                  {lead.contactEmail && <div style={{ fontSize: '0.875rem', color: '#666' }}>{lead.contactEmail}</div>}
                </td>
                <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                  {new Date(lead.createdAt).toLocaleDateString()}
                </td>
                <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                  {lead.source || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Manual Phone Modal Component
function ManualPhoneModal({ siteId, onClose, onSuccess }: { siteId: string; onClose: () => void; onSuccess: () => void }) {
  const [trackingNumber, setTrackingNumber] = useState('');
  const [forwardToNumber, setForwardToNumber] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!trackingNumber.trim()) {
      alert('Please enter a tracking number');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/phone/set-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, trackingNumber, forwardToNumber: forwardToNumber || undefined }),
      });

      if (res.ok) {
        alert('Phone number saved successfully!');
        onSuccess();
        onClose();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to save phone number');
      }
    } catch (error) {
      console.error('Error saving phone:', error);
      alert('Failed to save phone number');
    } finally {
      setSaving(false);
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
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '8px',
        maxWidth: '500px',
        width: '90%'
      }}>
        <h2 style={{ marginTop: 0 }}>Set Phone Number Manually</h2>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Tracking Number *
          </label>
          <input
            type="text"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="+18135551234"
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Forward To (optional)
          </label>
          <input
            type="text"
            value={forwardToNumber}
            onChange={(e) => setForwardToNumber(e.target.value)}
            placeholder="+1234567890"
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
          />
          <small style={{ color: '#666' }}>For documentation only</small>
        </div>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: saving ? '#ccc' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: saving ? 'not-allowed' : 'pointer'
            }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Twilio Phone Modal Component
function TwilioPhoneModal({ siteId, onClose, onSuccess }: { siteId: string; onClose: () => void; onSuccess: () => void }) {
  const [areaCode, setAreaCode] = useState('');
  const [numbers, setNumbers] = useState<Array<{ phoneNumber: string; friendlyName: string }>>([]);
  const [selectedNumber, setSelectedNumber] = useState('');
  const [forwardToNumber, setForwardToNumber] = useState('');
  const [searching, setSearching] = useState(false);
  const [buying, setBuying] = useState(false);

  const handleSearch = async () => {
    if (!areaCode.trim()) {
      alert('Please enter an area code');
      return;
    }

    setSearching(true);
    try {
      const res = await fetch('/api/phone/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ areaCode }),
      });

      if (res.ok) {
        const data = await res.json();
        setNumbers(data.numbers || []);
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to search numbers');
      }
    } catch (error) {
      console.error('Error searching:', error);
      alert('Failed to search phone numbers');
    } finally {
      setSearching(false);
    }
  };

  const handleBuy = async () => {
    if (!selectedNumber || !forwardToNumber.trim()) {
      alert('Please select a number and enter a forward-to number');
      return;
    }

    setBuying(true);
    try {
      const res = await fetch('/api/phone/buy-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, phoneNumber: selectedNumber, forwardToNumber }),
      });

      if (res.ok) {
        alert('Phone number purchased successfully!');
        onSuccess();
        onClose();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to purchase number');
      }
    } catch (error) {
      console.error('Error buying:', error);
      alert('Failed to purchase phone number');
    } finally {
      setBuying(false);
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
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '8px',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        <h2 style={{ marginTop: 0 }}>Buy Phone Number from Twilio</h2>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Area Code
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={areaCode}
              onChange={(e) => setAreaCode(e.target.value)}
              placeholder="813"
              maxLength={3}
              style={{ flex: 1, padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
            />
            <button
              onClick={handleSearch}
              disabled={searching}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: searching ? '#ccc' : '#0070f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: searching ? 'not-allowed' : 'pointer'
              }}
            >
              {searching ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        {numbers.length > 0 && (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Select Number
              </label>
              <select
                value={selectedNumber}
                onChange={(e) => setSelectedNumber(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
              >
                <option value="">Choose a number...</option>
                {numbers.map((n) => (
                  <option key={n.phoneNumber} value={n.phoneNumber}>
                    {n.phoneNumber} {n.friendlyName ? `(${n.friendlyName})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Forward To *
              </label>
              <input
                type="text"
                value={forwardToNumber}
                onChange={(e) => setForwardToNumber(e.target.value)}
                placeholder="+1234567890"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>Cancel</button>
          {numbers.length > 0 && (
            <button
              onClick={handleBuy}
              disabled={buying || !selectedNumber || !forwardToNumber.trim()}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: buying || !selectedNumber || !forwardToNumber.trim() ? '#ccc' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: buying || !selectedNumber || !forwardToNumber.trim() ? 'not-allowed' : 'pointer'
              }}
            >
              {buying ? 'Purchasing...' : 'Buy & Assign'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// VoIP.ms Phone Modal Component
function VoipmsPhoneModal({ siteId, onClose, onSuccess }: { siteId: string; onClose: () => void; onSuccess: () => void }) {
  const [numbers, setNumbers] = useState<Array<{ phoneNumber: string; routing: string; pop: string }>>([]);
  const [selectedNumber, setSelectedNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const handleImport = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/phone/voipms/import');
      if (res.ok) {
        const data = await res.json();
        setNumbers(data.numbers || []);
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to import numbers');
      }
    } catch (error) {
      console.error('Error importing:', error);
      alert('Failed to import phone numbers');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedNumber) {
      alert('Please select a number');
      return;
    }

    setAssigning(true);
    try {
      const res = await fetch('/api/phone/set-voipms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, phoneNumber: selectedNumber }),
      });

      if (res.ok) {
        alert('Phone number assigned successfully!');
        onSuccess();
        onClose();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to assign number');
      }
    } catch (error) {
      console.error('Error assigning:', error);
      alert('Failed to assign phone number');
    } finally {
      setAssigning(false);
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
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '8px',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        <h2 style={{ marginTop: 0 }}>Import Phone Number from VoIP.ms</h2>
        
        <div style={{ marginBottom: '1rem' }}>
          <button
            onClick={handleImport}
            disabled={loading}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: loading ? '#ccc' : '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Importing...' : 'Import Numbers from VoIP.ms'}
          </button>
        </div>

        {numbers.length > 0 && (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Select Number
              </label>
              <select
                value={selectedNumber}
                onChange={(e) => setSelectedNumber(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
              >
                <option value="">Choose a number...</option>
                {numbers.map((n) => (
                  <option key={n.phoneNumber} value={n.phoneNumber}>
                    {n.phoneNumber} (POP: {n.pop})
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>Cancel</button>
          {numbers.length > 0 && (
            <button
              onClick={handleAssign}
              disabled={assigning || !selectedNumber}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: assigning || !selectedNumber ? '#ccc' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: assigning || !selectedNumber ? 'not-allowed' : 'pointer'
              }}
            >
              {assigning ? 'Assigning...' : 'Assign Number'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Generate domain suggestions based on city, state, keywords, and niche (fallback)
function generateDomainSuggestions(city: string, state: string, keywords: string[], niche: string): string[] {
  // Normalize inputs: lowercase, remove spaces and special chars
  const cleanCity = city.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanState = state.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanNiche = niche.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // Clean keywords: remove city/state from keyword, lowercase, remove spaces/special chars
  // Use top 3 keywords (API returns top 3 by volume)
  const cleanKeywords = keywords.slice(0, 3).map(kw => {
    // Remove city and state from keyword if present
    let cleaned = kw.toLowerCase();
    cleaned = cleaned.replace(new RegExp(city.toLowerCase(), 'gi'), '');
    cleaned = cleaned.replace(new RegExp(state.toLowerCase(), 'gi'), '');
    cleaned = cleaned.replace(/[^a-z0-9]/g, '');
    return cleaned;
  }).filter(kw => kw.length > 0);
  
  const suggestions: string[] = [];
  
  // Use keywords if available, otherwise fall back to niche
  const primaryTerms = cleanKeywords.length > 0 ? cleanKeywords : [cleanNiche];
  
  // Generate service-focused patterns per keyword
  for (const term of primaryTerms) {
    // Pattern 1: city + keyword
    suggestions.push(`${cleanCity}${term}.com`);
    
    // Pattern 2: keyword + city
    suggestions.push(`${term}${cleanCity}.com`);
    
    // Pattern 3: keyword + city + state
    suggestions.push(`${term}${cleanCity}${cleanState}.com`);
    
    // Pattern 4: city + keyword + pros
    suggestions.push(`${cleanCity}${term}pros.com`);
  }
  
  // Add company-sounding patterns (still include keyword)
  if (cleanKeywords.length > 0) {
    const topKeyword = cleanKeywords[0]; // Use top keyword for company patterns
    // Pattern 5: city + keyword + co (company)
    suggestions.push(`${cleanCity}${topKeyword}co.com`);
    
    // Pattern 6: keyword + pros + city
    suggestions.push(`${topKeyword}pros${cleanCity}.com`);
    
    // Pattern 7: keyword + co + city
    suggestions.push(`${topKeyword}co${cleanCity}.com`);
  }
  
  // Remove duplicates and return (should be 10-12 total suggestions)
  return [...new Set(suggestions)];
}

// Domain Registration Modal Component
function DomainModal({ 
  siteId, 
  city, 
  state, 
  niche,
  keywords,
  onClose, 
  onSuccess 
}: { 
  siteId: string; 
  city: string;
  state: string;
  niche: string;
  keywords: string[];
  onClose: () => void; 
  onSuccess: () => void;
}) {
  const [domain, setDomain] = useState('');
  const [availability, setAvailability] = useState<'unknown' | 'available' | 'taken' | 'error'>('unknown');
  const [checking, setChecking] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState('');
  const [suggestions] = useState<string[]>(() => generateDomainSuggestions(city, state, keywords, niche));
  const [suggestionAvailability, setSuggestionAvailability] = useState<Record<string, 'unknown' | 'available' | 'taken' | 'error' | 'checking'>>({});
  const [checkingAll, setCheckingAll] = useState(false);

  const handleCheck = async () => {
    if (!domain.trim()) {
      alert('Please enter a domain name');
      return;
    }

    setChecking(true);
    setError('');
    setAvailability('unknown');
    try {
      const res = await fetch('/api/domain/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      });

      if (res.ok) {
        const data = await res.json();
        setAvailability(data.status === 'available' ? 'available' : data.status === 'taken' ? 'taken' : 'error');
        if (data.status === 'error') {
          setError('Failed to check domain availability');
        }
      } else {
        const errorData = await res.json();
        setError(errorData.error || 'Failed to check domain availability');
        setAvailability('error');
      }
    } catch (error) {
      console.error('Error checking domain:', error);
      setError('Failed to check domain availability');
      setAvailability('error');
    } finally {
      setChecking(false);
    }
  };

  const handleCheckSuggestion = async (suggestion: string) => {
    setSuggestionAvailability(prev => ({ ...prev, [suggestion]: 'checking' }));
    try {
      const res = await fetch('/api/domain/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: suggestion }),
      });

      if (res.ok) {
        const data = await res.json();
        setSuggestionAvailability(prev => ({ 
          ...prev, 
          [suggestion]: data.status === 'available' ? 'available' : data.status === 'taken' ? 'taken' : 'error'
        }));
      } else {
        setSuggestionAvailability(prev => ({ ...prev, [suggestion]: 'error' }));
      }
    } catch (error) {
      console.error('Error checking suggestion:', error);
      setSuggestionAvailability(prev => ({ ...prev, [suggestion]: 'error' }));
    }
  };

  const handleCheckAll = async () => {
    setCheckingAll(true);
    // Check up to 5 suggestions at once
    const toCheck = suggestions.slice(0, 5);
    const promises = toCheck.map(suggestion => handleCheckSuggestion(suggestion));
    await Promise.all(promises);
    setCheckingAll(false);
  };

  const handleSelectSuggestion = (suggestion: string) => {
    setDomain(suggestion);
    setAvailability('unknown');
    // If we already checked this suggestion, use that result
    if (suggestionAvailability[suggestion] && suggestionAvailability[suggestion] !== 'unknown' && suggestionAvailability[suggestion] !== 'checking') {
      setAvailability(suggestionAvailability[suggestion] as 'available' | 'taken' | 'error');
    }
  };

  const handleRegister = async () => {
    if (!domain.trim() || availability !== 'available') {
      return;
    }

    setRegistering(true);
    setError('');
    try {
      const res = await fetch('/api/domain/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, domain }),
      });

      if (res.ok) {
        alert('Domain registered successfully!');
        onSuccess();
        onClose();
      } else {
        const errorData = await res.json();
        setError(errorData.error || 'Failed to register domain');
      }
    } catch (error) {
      console.error('Error registering domain:', error);
      setError('Failed to register domain');
    } finally {
      setRegistering(false);
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
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '8px',
        maxWidth: '500px',
        width: '90%'
      }}>
        <h2 style={{ marginTop: 0 }}>Domain Registration</h2>
        
        {/* Suggested Domains Section */}
        <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <label style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Suggested Domains</label>
            <button
              onClick={handleCheckAll}
              disabled={checkingAll}
              style={{
                padding: '0.25rem 0.75rem',
                fontSize: '0.75rem',
                backgroundColor: checkingAll ? '#ccc' : '#0070f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: checkingAll ? 'not-allowed' : 'pointer'
              }}
            >
              {checkingAll ? 'Checking...' : 'Check All'}
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {suggestions.slice(0, 6).map((suggestion) => {
              const status = suggestionAvailability[suggestion] || 'unknown';
              return (
                <div
                  key={suggestion}
                  onClick={() => handleSelectSuggestion(suggestion)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    backgroundColor: status === 'available' ? '#d4edda' : status === 'taken' ? '#f8d7da' : '#fff',
                    border: `1px solid ${status === 'available' ? '#c3e6cb' : status === 'taken' ? '#f5c6cb' : '#ddd'}`,
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (status !== 'checking') {
                      e.currentTarget.style.backgroundColor = status === 'available' ? '#c3e6cb' : status === 'taken' ? '#f5c6cb' : '#f0f0f0';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = status === 'available' ? '#d4edda' : status === 'taken' ? '#f8d7da' : '#fff';
                  }}
                >
                  <span style={{ color: status === 'available' ? '#155724' : status === 'taken' ? '#721c24' : '#333' }}>
                    {suggestion}
                  </span>
                  {status === 'checking' && (
                    <span style={{ fontSize: '0.75rem', color: '#666' }}>⏳</span>
                  )}
                  {status === 'available' && (
                    <span style={{ fontSize: '0.75rem', color: '#155724' }}>✓</span>
                  )}
                  {status === 'taken' && (
                    <span style={{ fontSize: '0.75rem', color: '#721c24' }}>✗</span>
                  )}
                  {status === 'unknown' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCheckSuggestion(suggestion);
                      }}
                      style={{
                        padding: '0.125rem 0.5rem',
                        fontSize: '0.7rem',
                        backgroundColor: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer'
                      }}
                    >
                      Check
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Domain Name
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={domain}
              onChange={(e) => {
                setDomain(e.target.value);
                setAvailability('unknown');
                setError('');
              }}
              placeholder="example.com"
              style={{ flex: 1, padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleCheck();
                }
              }}
            />
            <button
              onClick={handleCheck}
              disabled={checking || !domain.trim()}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: checking || !domain.trim() ? '#ccc' : '#0070f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: checking || !domain.trim() ? 'not-allowed' : 'pointer'
              }}
            >
              {checking ? 'Checking...' : 'Check'}
            </button>
          </div>
        </div>

        {availability !== 'unknown' && (
          <div style={{
            marginBottom: '1rem',
            padding: '1rem',
            borderRadius: '4px',
            backgroundColor: availability === 'available' ? '#d4edda' : availability === 'taken' ? '#f8d7da' : '#fff3cd',
            color: availability === 'available' ? '#155724' : availability === 'taken' ? '#721c24' : '#856404',
            border: `1px solid ${availability === 'available' ? '#c3e6cb' : availability === 'taken' ? '#f5c6cb' : '#ffeaa7'}`
          }}>
            {availability === 'available' && (
              <div>
                <strong>✓ Available</strong>
                <div style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                  This domain is available for registration.
                </div>
              </div>
            )}
            {availability === 'taken' && (
              <div>
                <strong>✗ Taken</strong>
                <div style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                  This domain is already registered.
                </div>
              </div>
            )}
            {availability === 'error' && (
              <div>
                <strong>⚠ Error</strong>
                <div style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                  Could not check domain availability. Please try again.
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div style={{
            marginBottom: '1rem',
            padding: '0.75rem',
            borderRadius: '4px',
            backgroundColor: '#f8d7da',
            color: '#721c24',
            fontSize: '0.875rem'
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ padding: '0.5rem 1rem', cursor: 'pointer', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: 'white' }}
          >
            Close
          </button>
          {availability === 'available' && (
            <button
              onClick={handleRegister}
              disabled={registering}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: registering ? '#ccc' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: registering ? 'not-allowed' : 'pointer'
              }}
            >
              {registering ? 'Registering...' : 'Register Domain'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Ringba Phone Modal Component
function RingbaPhoneModal({ siteId, onClose, onSuccess }: { siteId: string; onClose: () => void; onSuccess: () => void }) {
  const [areaCode, setAreaCode] = useState('');
  const [country, setCountry] = useState('US');
  const [numbers, setNumbers] = useState<Array<{ id: string; phoneNumber: string; friendlyName?: string }>>([]);
  const [selectedNumberId, setSelectedNumberId] = useState('');
  const [searching, setSearching] = useState(false);
  const [buying, setBuying] = useState(false);

  const handleSearch = async () => {
    setSearching(true);
    try {
      const res = await fetch('/api/phone/search-ringba', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ areaCode: areaCode || undefined, country }),
      });

      if (res.ok) {
        const data = await res.json();
        setNumbers(data.numbers || []);
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to search numbers');
      }
    } catch (error) {
      console.error('Error searching:', error);
      alert('Failed to search phone numbers');
    } finally {
      setSearching(false);
    }
  };

  const handleBuy = async () => {
    if (!selectedNumberId) {
      alert('Please select a number');
      return;
    }

    setBuying(true);
    try {
      const res = await fetch('/api/phone/buy-ringba', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, numberId: selectedNumberId }),
      });

      if (res.ok) {
        alert('Phone number purchased successfully!');
        onSuccess();
        onClose();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to purchase number');
      }
    } catch (error) {
      console.error('Error buying:', error);
      alert('Failed to purchase phone number');
    } finally {
      setBuying(false);
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
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '8px',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        <h2 style={{ marginTop: 0 }}>Buy Phone Number from Ringba</h2>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Area Code (optional)
          </label>
          <input
            type="text"
            value={areaCode}
            onChange={(e) => setAreaCode(e.target.value)}
            placeholder="813"
            maxLength={3}
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px', marginBottom: '0.5rem' }}
          />
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Country
          </label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px', marginBottom: '0.5rem' }}
          >
            <option value="US">United States</option>
            <option value="CA">Canada</option>
          </select>
          <button
            onClick={handleSearch}
            disabled={searching}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: searching ? '#ccc' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: searching ? 'not-allowed' : 'pointer'
            }}
          >
            {searching ? 'Searching...' : 'Search Numbers'}
          </button>
        </div>

        {numbers.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Select Number
            </label>
            <select
              value={selectedNumberId}
              onChange={(e) => setSelectedNumberId(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
            >
              <option value="">Choose a number...</option>
              {numbers.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.phoneNumber} {n.friendlyName ? `(${n.friendlyName})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>Cancel</button>
          {numbers.length > 0 && (
            <button
              onClick={handleBuy}
              disabled={buying || !selectedNumberId}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: buying || !selectedNumberId ? '#ccc' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: buying || !selectedNumberId ? 'not-allowed' : 'pointer'
              }}
            >
              {buying ? 'Purchasing...' : 'Buy & Assign'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface SitePage {
  id: string;
  pageType: string;
  slug: string;
  titleTag: string;
  h1: string | null;
  focusKeyword: string;
  status: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  htmlDraft: string | null;
  htmlEdited: string | null;
  notesForGpt: string | null;
  wpPageId: number | null;
  wpPermalink: string | null;
  wpEditUrl: string | null;
  latestPublishedAt: string | null;
}

interface Site {
  id: string;
  niche: { name: string; slug: string };
  city: string;
  state: string;
  siteName: string | null;
  domain: string | null;
  phoneSource: string | null;
  trackingNumber: string | null;
  twilioNumber: string | null;
  forwardToNumber: string | null;
  status: string;
  pages: SitePage[];
  promptProfile: { id: string; name: string } | null;
  keywords: string[];
}

export default function SiteFactoryDetailPage() {
  const router = useRouter();
  const { siteId } = router.query;
  const [site, setSite] = useState<Site | null>(null);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showDomainModal, setShowDomainModal] = useState(false);
  const [showManualPhoneModal, setShowManualPhoneModal] = useState(false);
  const [showTwilioModal, setShowTwilioModal] = useState(false);
  const [showRingbaModal, setShowRingbaModal] = useState(false);
  const [showVoipmsModal, setShowVoipmsModal] = useState(false);

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
      }
    } catch (error) {
      console.error('Error fetching site:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBuildDraft = async () => {
    if (!confirm('Generate draft pages using GPT? This will create/update pages with AI-generated content.')) {
      return;
    }

    setBuilding(true);
    try {
      const res = await fetch('/api/site/build-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: siteId, keywords: [] }),
      });

      if (res.ok) {
        const result = await res.json();
        alert(`Success! Created ${result.pagesCreated} new pages, updated ${result.totalPages - result.pagesCreated} existing pages.`);
        fetchSite();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to build draft pages');
      }
    } catch (error) {
      console.error('Error building draft:', error);
      alert('Failed to build draft pages');
    } finally {
      setBuilding(false);
    }
  };

  const handlePublish = async (mode: 'approved-only' | 'all-drafts' = 'approved-only') => {
    if (!confirm(`Publish ${mode === 'approved-only' ? 'approved' : 'all draft'} pages to WordPress?`)) {
      return;
    }

    setPublishing(true);
    try {
      const res = await fetch('/api/wp/publish-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: siteId, mode }),
      });

      if (res.ok) {
        const result = await res.json();
        alert(`Success! Published ${result.pagesPublished} pages to WordPress.`);
        fetchSite();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to publish site');
      }
    } catch (error) {
      console.error('Error publishing:', error);
      alert('Failed to publish site');
    } finally {
      setPublishing(false);
    }
  };

  const handleApprovePage = async (pageId: string, currentStatus: string | null) => {
    const newStatus = currentStatus === 'APPROVED' ? 'DRAFT' : 'APPROVED';
    try {
      const res = await fetch(`/api/page/${pageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        fetchSite();
      } else {
        alert('Failed to update page status');
      }
    } catch (error) {
      console.error('Error updating page:', error);
      alert('Failed to update page status');
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  if (!site) {
    return <div style={{ padding: '2rem' }}>Site not found</div>;
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ marginBottom: '2rem' }}>Site Factory: {site.siteName || `${site.city}, ${site.state}`}</h1>

      {/* Site Setup Panel */}
      <div style={{ 
        border: '1px solid #ddd', 
        borderRadius: '8px', 
        padding: '1.5rem', 
        marginBottom: '2rem',
        backgroundColor: '#f9f9f9'
      }}>
        <h2 style={{ marginTop: 0 }}>Site Setup</h2>
        
        <div style={{ marginBottom: '1rem' }}>
          <strong>Niche:</strong> {site.niche.name} | <strong>Location:</strong> {site.city}, {site.state} | <strong>Status:</strong> {site.status}
        </div>

        <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'white', borderRadius: '4px' }}>
          <strong>Domain:</strong> {site.domain || 'No domain'} 
          <button 
            onClick={() => setShowDomainModal(true)}
            style={{ marginLeft: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
          >
            {site.domain ? 'Change Domain' : 'Register Domain'}
          </button>
        </div>

        <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'white', borderRadius: '4px' }}>
          <div style={{ marginBottom: '0.5rem' }}>
            <strong>Phone Source:</strong> {site.phoneSource ? site.phoneSource.charAt(0).toUpperCase() + site.phoneSource.slice(1) : 'Not set'}
            {site.phoneSource && site.phoneSource !== 'MANUAL' && (
              <span style={{ marginLeft: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
                (Managed via {site.phoneSource === 'TWILIO' ? 'Twilio' : 'Ringba'})
              </span>
            )}
          </div>
          <div style={{ marginBottom: '0.5rem' }}>
            <strong>Tracking Number:</strong> {site.trackingNumber || site.twilioNumber || 'No phone number'}
            {site.forwardToNumber && (
              <span style={{ marginLeft: '0.5rem', color: '#666' }}>
                → {site.forwardToNumber}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button 
              onClick={() => setShowManualPhoneModal(true)}
              style={{ padding: '0.5rem 1rem', cursor: 'pointer', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px' }}
            >
              Set Manually
            </button>
            <button 
              onClick={() => setShowTwilioModal(true)}
              style={{ padding: '0.5rem 1rem', cursor: 'pointer', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '4px' }}
            >
              Buy from Twilio
            </button>
            <button 
              onClick={() => setShowRingbaModal(true)}
              style={{ padding: '0.5rem 1rem', cursor: 'pointer', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px' }}
            >
              Buy from Ringba
            </button>
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
          <button
            onClick={handleBuildDraft}
            disabled={building}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: building ? '#ccc' : '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: building ? 'not-allowed' : 'pointer',
              fontSize: '1rem'
            }}
          >
            {building ? 'Building...' : 'Build Draft Pages'}
          </button>
          
          <button
            onClick={() => handlePublish('approved-only')}
            disabled={publishing}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: publishing ? '#ccc' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: publishing ? 'not-allowed' : 'pointer',
              fontSize: '1rem'
            }}
          >
            {publishing ? 'Publishing...' : 'Publish Approved Pages'}
          </button>

          <button
            onClick={() => handlePublish('all-drafts')}
            disabled={publishing}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: publishing ? '#ccc' : '#ffc107',
              color: 'black',
              border: 'none',
              borderRadius: '4px',
              cursor: publishing ? 'not-allowed' : 'pointer',
              fontSize: '1rem'
            }}
          >
            {publishing ? 'Publishing...' : 'Publish All Drafts'}
          </button>
        </div>
      </div>

      {/* Leads Section */}
      <LeadsPanel siteId={siteId as string} />

      {/* Citations Panel */}
      <CitationsPanel siteId={siteId as string} />

      {/* Pages Table */}
      <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '1.5rem' }}>
        <h2 style={{ marginTop: 0 }}>Pages ({site.pages.length})</h2>
        
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd' }}>
              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Type</th>
              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Slug</th>
              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Keyword</th>
              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Status</th>
              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Published</th>
              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {site.pages.map((page) => (
              <tr key={page.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.75rem' }}>{page.pageType}</td>
                <td style={{ padding: '0.75rem' }}>{page.slug || '(home)'}</td>
                <td style={{ padding: '0.75rem' }}>{page.focusKeyword}</td>
                <td style={{ padding: '0.75rem' }}>
                  <span style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    backgroundColor: page.status === 'APPROVED' ? '#d4edda' : page.status === 'PUBLISHED' ? '#cce5ff' : '#fff3cd',
                    color: page.status === 'APPROVED' ? '#155724' : page.status === 'PUBLISHED' ? '#004085' : '#856404',
                    fontSize: '0.875rem'
                  }}>
                    {page.status || 'draft'}
                  </span>
                </td>
                <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                  {page.wpPermalink ? (
                    <div>
                      <div>✓ Published</div>
                      {page.latestPublishedAt && (
                        <div style={{ color: '#666', fontSize: '0.75rem' }}>
                          {new Date(page.latestPublishedAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span style={{ color: '#999' }}>Not published</span>
                  )}
                </td>
                <td style={{ padding: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/sites/${siteId}/pages/${page.id}`);
                      }}
                      style={{ padding: '0.25rem 0.75rem', cursor: 'pointer', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: 'white' }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm('Regenerate this page with GPT? This will replace the current draft.')) return;
                        try {
                          const res = await fetch(`/api/v5000/sites/${siteId}/pages/${page.id}/regenerate`, {
                            method: 'POST',
                          });
                          if (res.ok) {
                            alert('Page regenerated successfully!');
                            fetchSite();
                          } else {
                            alert('Failed to regenerate page');
                          }
                        } catch (error) {
                          console.error('Error regenerating:', error);
                          alert('Failed to regenerate page');
                        }
                      }}
                      style={{ padding: '0.25rem 0.75rem', cursor: 'pointer', border: '1px solid #0070f3', borderRadius: '4px', backgroundColor: '#0070f3', color: 'white' }}
                    >
                      Regenerate
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApprovePage(page.id, page.status);
                      }}
                      style={{
                        padding: '0.25rem 0.75rem',
                        cursor: 'pointer',
                        backgroundColor: page.status === 'APPROVED' ? '#dc3545' : '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px'
                      }}
                    >
                      {page.status === 'APPROVED' ? 'Unapprove' : 'Approve'}
                    </button>
                    {page.wpPermalink && (
                      <a
                        href={page.wpPermalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{ padding: '0.25rem 0.75rem', textDecoration: 'none', color: '#0070f3', border: '1px solid #0070f3', borderRadius: '4px' }}
                      >
                        View
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {showDomainModal && site && (
        <DomainModal 
          siteId={siteId as string} 
          city={site.city}
          state={site.state}
          niche={site.niche.slug}
          keywords={site.keywords || []}
          onClose={() => setShowDomainModal(false)} 
          onSuccess={fetchSite} 
        />
      )}

      {/* Manual Phone Modal */}
      {showManualPhoneModal && <ManualPhoneModal siteId={siteId as string} onClose={() => setShowManualPhoneModal(false)} onSuccess={fetchSite} />}

      {/* Twilio Phone Modal */}
      {showTwilioModal && <TwilioPhoneModal siteId={siteId as string} onClose={() => setShowTwilioModal(false)} onSuccess={fetchSite} />}

      {/* Ringba Phone Modal */}
      {showRingbaModal && <RingbaPhoneModal siteId={siteId as string} onClose={() => setShowRingbaModal(false)} onSuccess={fetchSite} />}

      {/* VoIP.ms Phone Modal */}
      {showVoipmsModal && <VoipmsPhoneModal siteId={siteId as string} onClose={() => setShowVoipmsModal(false)} onSuccess={fetchSite} />}
    </div>
  );
}

