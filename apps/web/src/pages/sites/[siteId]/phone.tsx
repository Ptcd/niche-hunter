/**
 * Phone Wiring Page
 * 
 * Beautiful UI for configuring call routing: forward-to, whisper, and IVR.
 */

import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

interface IVROption {
  digit: string;
  label: string;
  forwardTo: string;
}

interface PhoneConfig {
  trackingNumber: string | null;
  forwardToNumber: string | null;
  whisperEnabled: boolean;
  whisperMessage: string | null;
  ivrEnabled: boolean;
  ivrGreeting: string | null;
  ivrOptions: IVROption[] | null;
}

export default function PhoneWiringPage() {
  const router = useRouter();
  const { siteId } = router.query;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<PhoneConfig | null>(null);
  const [siteName, setSiteName] = useState<string>('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (siteId && typeof siteId === 'string') {
      fetchConfig();
      fetchSiteName();
    }
  }, [siteId]);

  const fetchSiteName = async () => {
    try {
      const res = await fetch(`/api/v5000/sites/${siteId}`);
      if (res.ok) {
        const data = await res.json();
        setSiteName(data.siteName || `${data.city}, ${data.state}`);
      }
    } catch (error) {
      console.error('Error fetching site:', error);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch(`/api/phone/${siteId}/config`);
      if (res.ok) {
        const data = await res.json();
        setConfig({
          trackingNumber: data.trackingNumber,
          forwardToNumber: data.forwardToNumber || '',
          whisperEnabled: data.whisperEnabled || false,
          whisperMessage: data.whisperMessage || '',
          ivrEnabled: data.ivrEnabled || false,
          ivrGreeting: data.ivrGreeting || '',
          ivrOptions: (data.ivrOptions as IVROption[]) || [],
        });
      }
    } catch (error) {
      console.error('Error fetching config:', error);
      showToast('Failed to load configuration', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async () => {
    if (!config) return;

    // Validation
    if (!config.forwardToNumber?.trim()) {
      showToast('Forward-to number is required', 'error');
      return;
    }

    if (config.whisperEnabled && !config.whisperMessage?.trim()) {
      showToast('Whisper message is required when whisper is enabled', 'error');
      return;
    }

    if (config.ivrEnabled) {
      if (!config.ivrGreeting?.trim()) {
        showToast('IVR greeting is required when IVR is enabled', 'error');
        return;
      }
      if (!config.ivrOptions || config.ivrOptions.length === 0) {
        showToast('At least one IVR option is required', 'error');
        return;
      }
      // Validate IVR options
      for (const opt of config.ivrOptions) {
        if (!opt.digit || !opt.label || !opt.forwardTo) {
          showToast('All IVR options must have digit, label, and forward number', 'error');
          return;
        }
      }
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/phone/${siteId}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          forwardToNumber: config.forwardToNumber,
          whisperEnabled: config.whisperEnabled,
          whisperMessage: config.whisperEnabled ? config.whisperMessage : null,
          ivrEnabled: config.ivrEnabled,
          ivrGreeting: config.ivrEnabled ? config.ivrGreeting : null,
          ivrOptions: config.ivrEnabled ? config.ivrOptions : null,
        }),
      });

      if (res.ok) {
        showToast('Configuration saved successfully!', 'success');
      } else {
        const error = await res.json();
        showToast(error.error || 'Failed to save configuration', 'error');
      }
    } catch (error) {
      console.error('Error saving config:', error);
      showToast('Failed to save configuration', 'error');
    } finally {
      setSaving(false);
    }
  };

  const addIVROption = () => {
    if (!config) return;
    const nextDigit = String((config.ivrOptions?.length || 0) + 1);
    if (parseInt(nextDigit) > 9) {
      showToast('Maximum 9 IVR options allowed', 'error');
      return;
    }
    setConfig({
      ...config,
      ivrOptions: [
        ...(config.ivrOptions || []),
        { digit: nextDigit, label: '', forwardTo: '' },
      ],
    });
  };

  const removeIVROption = (index: number) => {
    if (!config) return;
    const newOptions = [...(config.ivrOptions || [])];
    newOptions.splice(index, 1);
    setConfig({ ...config, ivrOptions: newOptions });
  };

  const updateIVROption = (index: number, field: keyof IVROption, value: string) => {
    if (!config) return;
    const newOptions = [...(config.ivrOptions || [])];
    newOptions[index] = { ...newOptions[index], [field]: value };
    setConfig({ ...config, ivrOptions: newOptions });
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
    );
  }

  if (!config) {
    return (
      <div style={{ padding: '2rem' }}>Failed to load configuration</div>
    );
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '1rem 1.5rem',
            backgroundColor: toast.type === 'success' ? '#28a745' : '#dc3545',
            color: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            zIndex: 1000,
            animation: 'slideIn 0.3s ease-out',
          }}
        >
          {toast.message}
        </div>
      )}

      <div style={{ marginBottom: '2rem' }}>
        <button
          onClick={() => router.push(`/sites/${siteId}`)}
          style={{
            padding: '0.5rem 1rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
            backgroundColor: 'white',
            cursor: 'pointer',
            marginBottom: '1rem',
          }}
        >
          ← Back to Site
        </button>
        <h1 style={{ margin: 0 }}>Phone Wiring: {siteName}</h1>
      </div>

      {/* Phone Number Card */}
      <div
        style={{
          backgroundColor: 'white',
          border: '1px solid #e0e0e0',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: '600' }}>
              Tracking Number
            </h3>
            <div style={{ fontSize: '1.25rem', color: '#333', fontWeight: '500' }}>
              {config.trackingNumber || 'No number assigned'}
            </div>
          </div>
          {config.trackingNumber && (
            <span
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#d4edda',
                color: '#155724',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontWeight: '500',
              }}
            >
              Active
            </span>
          )}
        </div>
      </div>

      {/* Forward To */}
      <div
        style={{
          backgroundColor: 'white',
          border: '1px solid #e0e0e0',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        }}
      >
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: '600' }}>
          Forward To
        </h3>
        <input
          type="text"
          value={config.forwardToNumber || ''}
          onChange={(e) => setConfig({ ...config, forwardToNumber: e.target.value })}
          placeholder="+1234567890"
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '1rem',
          }}
        />
        <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
          Calls will be forwarded to this number
        </div>
      </div>

      {/* Whisper Toggle */}
      <div
        style={{
          backgroundColor: 'white',
          border: '1px solid #e0e0e0',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem', fontWeight: '600' }}>
              Whisper Message
            </h3>
            <div style={{ fontSize: '0.875rem', color: '#666' }}>
              Play a message to the agent before connecting the call
            </div>
          </div>
          <label
            style={{
              position: 'relative',
              display: 'inline-block',
              width: '50px',
              height: '28px',
            }}
          >
            <input
              type="checkbox"
              checked={config.whisperEnabled}
              onChange={(e) => setConfig({ ...config, whisperEnabled: e.target.checked })}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span
              style={{
                position: 'absolute',
                cursor: 'pointer',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: config.whisperEnabled ? '#28a745' : '#ccc',
                borderRadius: '28px',
                transition: '0.3s',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  content: '""',
                  height: '20px',
                  width: '20px',
                  left: '4px',
                  bottom: '4px',
                  backgroundColor: 'white',
                  borderRadius: '50%',
                  transition: '0.3s',
                  transform: config.whisperEnabled ? 'translateX(22px)' : 'translateX(0)',
                }}
              />
            </span>
          </label>
        </div>
        {config.whisperEnabled && (
          <div style={{ marginTop: '1rem' }}>
            <textarea
              value={config.whisperMessage || ''}
              onChange={(e) => setConfig({ ...config, whisperMessage: e.target.value })}
              placeholder={`New lead from ${siteName}`}
              rows={3}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '1rem',
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
            <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
              {(config.whisperMessage || '').length} characters
            </div>
          </div>
        )}
      </div>

      {/* IVR Builder */}
      <div
        style={{
          backgroundColor: 'white',
          border: '1px solid #e0e0e0',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem', fontWeight: '600' }}>
              IVR Menu
            </h3>
            <div style={{ fontSize: '0.875rem', color: '#666' }}>
              Create a menu system for callers to select options
            </div>
          </div>
          <label
            style={{
              position: 'relative',
              display: 'inline-block',
              width: '50px',
              height: '28px',
            }}
          >
            <input
              type="checkbox"
              checked={config.ivrEnabled}
              onChange={(e) => setConfig({ ...config, ivrEnabled: e.target.checked })}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span
              style={{
                position: 'absolute',
                cursor: 'pointer',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: config.ivrEnabled ? '#28a745' : '#ccc',
                borderRadius: '28px',
                transition: '0.3s',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  content: '""',
                  height: '20px',
                  width: '20px',
                  left: '4px',
                  bottom: '4px',
                  backgroundColor: 'white',
                  borderRadius: '50%',
                  transition: '0.3s',
                  transform: config.ivrEnabled ? 'translateX(22px)' : 'translateX(0)',
                }}
              />
            </span>
          </label>
        </div>

        {config.ivrEnabled && (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Greeting Message
              </label>
              <textarea
                value={config.ivrGreeting || ''}
                onChange={(e) => setConfig({ ...config, ivrGreeting: e.target.value })}
                placeholder="Thanks for calling. Press 1 for sales, press 2 for support..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <label style={{ fontWeight: '500' }}>Menu Options</label>
                <button
                  onClick={addIVROption}
                  disabled={(config.ivrOptions?.length || 0) >= 9}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: (config.ivrOptions?.length || 0) >= 9 ? '#ccc' : '#0070f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: (config.ivrOptions?.length || 0) >= 9 ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                  }}
                >
                  + Add Option
                </button>
              </div>

              {(config.ivrOptions || []).map((option, index) => (
                <div
                  key={index}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '60px 1fr 200px auto',
                    gap: '0.75rem',
                    marginBottom: '0.75rem',
                    padding: '1rem',
                    backgroundColor: '#f9f9f9',
                    borderRadius: '8px',
                    alignItems: 'center',
                  }}
                >
                  <input
                    type="text"
                    value={option.digit}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^1-9]/g, '');
                      if (val.length <= 1) {
                        updateIVROption(index, 'digit', val);
                      }
                    }}
                    placeholder="1"
                    maxLength={1}
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      textAlign: 'center',
                      fontWeight: '600',
                      fontSize: '1rem',
                    }}
                  />
                  <input
                    type="text"
                    value={option.label}
                    onChange={(e) => updateIVROption(index, 'label', e.target.value)}
                    placeholder="Sales"
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                    }}
                  />
                  <input
                    type="text"
                    value={option.forwardTo}
                    onChange={(e) => updateIVROption(index, 'forwardTo', e.target.value)}
                    placeholder="+1234567890"
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                    }}
                  />
                  <button
                    onClick={() => removeIVROption(index)}
                    style={{
                      padding: '0.5rem',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '1.25rem',
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}

              {(!config.ivrOptions || config.ivrOptions.length === 0) && (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>
                  No options yet. Click "Add Option" to create your first menu item.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Call Flow Preview */}
      <div
        style={{
          backgroundColor: '#f8f9fa',
          border: '1px solid #e0e0e0',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: '600' }}>
          Call Flow Preview
        </h3>
        <div style={{ fontSize: '0.875rem', color: '#666', lineHeight: '1.8' }}>
          <div>📞 <strong>Incoming Call</strong></div>
          {config.ivrEnabled && (
            <>
              <div style={{ marginLeft: '1rem' }}>↓</div>
              <div style={{ marginLeft: '1rem' }}>🎵 <strong>IVR Greeting:</strong> "{config.ivrGreeting || '...'}"</div>
              <div style={{ marginLeft: '1rem' }}>↓</div>
              <div style={{ marginLeft: '1rem' }}>🔢 <strong>Caller selects option</strong></div>
            </>
          )}
          {config.whisperEnabled && (
            <>
              <div style={{ marginLeft: config.ivrEnabled ? '2rem' : '1rem' }}>↓</div>
              <div style={{ marginLeft: config.ivrEnabled ? '2rem' : '1rem' }}>👂 <strong>Whisper:</strong> "{config.whisperMessage || '...'}"</div>
            </>
          )}
          <div style={{ marginLeft: config.ivrEnabled || config.whisperEnabled ? '2rem' : '1rem' }}>↓</div>
          <div style={{ marginLeft: config.ivrEnabled || config.whisperEnabled ? '2rem' : '1rem' }}>📱 <strong>Forward to:</strong> {config.forwardToNumber || 'Not set'}</div>
        </div>
      </div>

      {/* Save Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
        <button
          onClick={() => router.push(`/sites/${siteId}`)}
          style={{
            padding: '0.75rem 1.5rem',
            border: '1px solid #ddd',
            borderRadius: '6px',
            backgroundColor: 'white',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: saving ? '#ccc' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
            fontWeight: '500',
          }}
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>
    </div>
  );
}

