import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import AuthGuard from '../../components/AuthGuard';
import { supabase } from '../../lib/supabase/client';

function V5000IndexPageContent() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [account, setAccount] = useState<any>(null);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      // Fetch user and account data
      const res = await fetch('/api/v5000/account/current');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setAccount(data.account);
      }
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header with user info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid #ddd' }}>
        <div>
          <h1 style={{ margin: 0 }}>V5000 Rank-and-Rent Opportunity Finder</h1>
          {account && (
            <p style={{ margin: '0.5rem 0 0 0', color: '#666', fontSize: '0.9rem' }}>
              {account.name} • {user?.name || user?.email}
            </p>
          )}
        </div>
        <button
          onClick={handleLogout}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Logout
        </button>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
        {/* Control Tower */}
        <div
          style={{
            padding: '1.5rem',
            border: '2px solid #0070f3',
            borderRadius: '8px',
            cursor: 'pointer',
            backgroundColor: '#f0f8ff',
            transition: 'all 0.2s',
          }}
          onClick={() => router.push('/control-tower')}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#e0f0ff';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,112,243,0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#f0f8ff';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <h2 style={{ marginTop: 0, color: '#0070f3' }}>🚀 Control Tower</h2>
          <p style={{ marginBottom: 0 }}>Monitor all sites, metrics, ROI, and alerts</p>
        </div>

        {/* Site Factory */}
        <div
          style={{
            padding: '1.5rem',
            border: '2px solid #28a745',
            borderRadius: '8px',
            cursor: 'pointer',
            backgroundColor: '#f0fff4',
            transition: 'all 0.2s',
          }}
          onClick={() => router.push('/v5000/batches')}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#e0ffe0';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(40,167,69,0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#f0fff4';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <h2 style={{ marginTop: 0, color: '#28a745' }}>🏭 Site Factory</h2>
          <p style={{ marginBottom: 0 }}>Build and manage sites from batches</p>
        </div>

        {/* Niches */}
        <div
          style={{
            padding: '1.5rem',
            border: '1px solid #ddd',
            borderRadius: '8px',
            cursor: 'pointer',
            backgroundColor: '#fff',
            transition: 'all 0.2s',
          }}
          onClick={() => router.push('/v5000/niches')}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f8f9fa';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#fff';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <h2 style={{ marginTop: 0 }}>📊 Niches</h2>
          <p style={{ marginBottom: 0 }}>Manage niches and keywords</p>
        </div>
        
        {/* Batches */}
        <div
          style={{
            padding: '1.5rem',
            border: '1px solid #ddd',
            borderRadius: '8px',
            cursor: 'pointer',
            backgroundColor: '#fff',
            transition: 'all 0.2s',
          }}
          onClick={() => router.push('/v5000/batches')}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f8f9fa';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#fff';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <h2 style={{ marginTop: 0 }}>📦 Batches</h2>
          <p style={{ marginBottom: 0 }}>View and manage scan batches</p>
        </div>
      </div>
    </div>
  );
}

export default function V5000IndexPage() {
  return (
    <AuthGuard>
      <V5000IndexPageContent />
    </AuthGuard>
  );
}



