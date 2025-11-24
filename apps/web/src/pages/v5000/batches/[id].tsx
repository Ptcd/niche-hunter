import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

interface ProcessingLogEntry {
  keyword: string;
  volume?: number | null;
  cpc?: number | null;
  kd?: number | null;
  status: 'checking' | 'passed' | 'filtered';
  reason?: string;
  timestamp: string;
}

interface KeywordResult {
  id: string;
  localizedQuery: string;
  city: {
    city: string;
    state: string;
    payout: number | null;
  };
  nicheKeyword: {
    keyword: string;
  };
  metrics?: {
    searchVolume: number | null;
    cpc: number | null;
    kd: number | null;
  };
  difficultyScore?: {
    serpWeakness: number | null;
    localPackStrength: number | null;
    onpageCompetence: number | null;
    finalDifficulty: number | null;
    opportunity: number | null;
    serpDifficulty: number | null;
    kdComponent: number | null;
    serpComponent: number | null;
    packComponent: number | null;
    onpageComponent: number | null;
    cpcMultiplier: number | null;
    leadValueMultiplier: number | null;
    baseOpportunity: number | null;
  };
  leadValue?: number | null;
}

interface Batch {
  id: string;
  name?: string;
  status: string;
  totalKeywords?: number;
  processedKeywords: number;
  skippedCities: number;
  processingLog?: { entries: ProcessingLogEntry[] } | null;
  keywords: KeywordResult[];
  niche: {
    name: string;
  };
}

export default function BatchResultsPage() {
  const router = useRouter();
  const { id } = router.query;
  const [batch, setBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(true);
  const [minVolume, setMinVolume] = useState('');
  const [maxDifficulty, setMaxDifficulty] = useState('');
  const [sortBy, setSortBy] = useState<'opportunity' | 'difficulty' | 'volume' | 'competition'>('opportunity');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set());
  const [editedLeadValues, setEditedLeadValues] = useState<Map<string, number>>(new Map());
  const [discoveringCities, setDiscoveringCities] = useState<Set<string>>(new Set());
  const [discoveringNational, setDiscoveringNational] = useState(false);
  const [keywordStats, setKeywordStats] = useState<{
    local: { total: number; money: number; supporting: number; informational: number };
    national: { total: number; money: number; supporting: number; informational: number };
  } | null>(null);

  useEffect(() => {
    if (id) {
      fetchBatch();
      // Poll for updates if still processing
      const interval = setInterval(() => {
        if (batch?.status === 'running' || batch?.status === 'queued') {
          fetchBatch();
        }
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [id, batch?.status]);

  // Auto-scroll processing log to bottom when new entries are added
  useEffect(() => {
    if (batch?.status === 'running' && batch.processingLog?.entries) {
      const container = document.getElementById('processing-log-container');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [batch?.processingLog?.entries?.length, batch?.status]);

  const fetchBatch = async () => {
    try {
      const res = await fetch(`/api/v5000/batches/${id}`);
      if (res.ok) {
        const data = await res.json();
        setBatch(data);
        // Fetch keyword stats
        fetchKeywordStats();
      }
    } catch (error) {
      console.error('Error fetching batch:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchKeywordStats = async () => {
    if (!id || typeof id !== 'string') return;
    try {
      const res = await fetch(`/api/v5000/batches/${id}/keyword-stats`);
      if (res.ok) {
        const stats = await res.json();
        setKeywordStats(stats);
      }
    } catch (error) {
      console.error('Error fetching keyword stats:', error);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to stop this batch?')) {
      return;
    }

    try {
      const res = await fetch(`/api/v5000/batches/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      if (res.ok) {
        fetchBatch();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to cancel batch');
      }
    } catch (error) {
      console.error('Error cancelling batch:', error);
      alert('Failed to cancel batch');
    }
  };

  const toggleRow = (keywordId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(keywordId)) {
      newExpanded.delete(keywordId);
    } else {
      newExpanded.add(keywordId);
    }
    setExpandedRows(newExpanded);
  };

  const toggleCity = (cityKey: string) => {
    const newExpanded = new Set(expandedCities);
    if (newExpanded.has(cityKey)) {
      newExpanded.delete(cityKey);
    } else {
      newExpanded.add(cityKey);
    }
    setExpandedCities(newExpanded);
  };

  const handleDownloadCityKeywords = async (city: string, state: string) => {
    if (!id || typeof id !== 'string' || !batch) {
      alert('Invalid batch ID');
      return;
    }

    try {
      const url = `/api/v5000/batches/${id}/download-city-keywords?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to download keywords');
      }

      // Get the blob from the response
      const blob = await response.blob();
      
      // Create a download link and trigger it
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      
      // Use niche-city-state format for filename
      const nicheName = batch.niche.name.replace(/[^a-z0-9-]/gi, '-');
      const cityName = city.replace(/[^a-z0-9-]/gi, '-');
      const stateName = state.replace(/[^a-z0-9-]/gi, '-');
      link.download = `${nicheName}-${cityName}-${stateName}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error: any) {
      console.error('Error downloading keywords:', error);
      alert(error.message || 'Failed to download keywords');
    }
  };

  const handleBuildSite = async (city: string, state: string, leadValue: number) => {
    if (!id || typeof id !== 'string' || !batch) {
      alert('Invalid batch ID');
      return;
    }

    try {
      const response = await fetch('/api/v5000/sites/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId: id,
          niche: batch.niche.name,
          city,
          state,
          leadValue,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create site');
      }

      const result = await response.json();
      
      // Navigate to the new Site Factory page
      router.push(`/sites/${result.siteId}`);
    } catch (error: any) {
      console.error('Error building site:', error);
      alert(error.message || 'Failed to build site');
    }
  };

  const handleDiscoverKeywords = async (city: string, state: string) => {
    console.log('[FRONTEND] handleDiscoverKeywords called for:', city, state);
    
    if (!id || typeof id !== 'string') {
      alert('Invalid batch ID');
      return;
    }

    const cityKey = `${city}, ${state}`;
    
    console.log('[FRONTEND] Making API request to:', `/api/v5000/batches/${id}/discover-keywords`);
    
    // Set loading state
    setDiscoveringCities(prev => new Set(prev).add(cityKey));

    try {
      const response = await fetch(`/api/v5000/batches/${id}/discover-keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, state }),
      });
      
      console.log('[FRONTEND] Response status:', response.status);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to discover keywords');
      }

      const result = await response.json();
      alert(`✅ Successfully discovered ${result.added} new keywords! ${result.processed} were processed with full SERP analysis.`);
      
      // Refresh batch data to show new keywords
      fetchBatch();
    } catch (error: any) {
      console.error('Error discovering keywords:', error);
      alert(error.message || 'Failed to discover keywords');
    } finally {
      // Clear loading state
      setDiscoveringCities(prev => {
        const newSet = new Set(prev);
        newSet.delete(cityKey);
        return newSet;
      });
    }
  };

  const handleDiscoverNationalKeywords = async () => {
    if (!id || typeof id !== 'string') {
      alert('Invalid batch ID');
      return;
    }

    setDiscoveringNational(true);

    try {
      const response = await fetch(`/api/v5000/batches/${id}/discover-national-keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to discover national keywords');
      }

      const result = await response.json();
      alert(`✅ Successfully discovered ${result.added} national keywords! (${result.byType?.money || 0} money, ${result.byType?.supporting || 0} supporting, ${result.byType?.informational || 0} informational)`);
      
      // Refresh stats
      fetchKeywordStats();
    } catch (error: any) {
      console.error('Error discovering national keywords:', error);
      alert(error.message || 'Failed to discover national keywords');
    } finally {
      setDiscoveringNational(false);
    }
  };

  const handleExportKeywords = async () => {
    if (!id || typeof id !== 'string') {
      alert('Invalid batch ID');
      return;
    }

    try {
      const response = await fetch(`/api/v5000/batches/${id}/export-keywords`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to export keywords');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      
      const filename = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || `keywords-${id}.xlsx`;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error: any) {
      console.error('Error exporting keywords:', error);
      alert(error.message || 'Failed to export keywords');
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem' }}>Loading...</div>;
  }

  if (!batch) {
    return <div style={{ padding: '2rem' }}>Batch not found</div>;
  }

  // Filter keywords
  let filteredKeywords = batch.keywords || [];
  
  if (minVolume) {
    const minVol = parseInt(minVolume);
    filteredKeywords = filteredKeywords.filter(
      (kw) => (kw.metrics?.searchVolume || 0) >= minVol
    );
  }

  if (maxDifficulty) {
    const maxDiff = parseFloat(maxDifficulty);
    filteredKeywords = filteredKeywords.filter(
      (kw) => (kw.difficultyScore?.finalDifficulty || 100) <= maxDiff
    );
  }

  // Group keywords by city
  interface CityData {
    city: string;
    state: string;
    keywords: KeywordResult[];
    totalOpportunity: number;
    totalVolume: number;
    avgDifficulty: number;
    leadValue: number;
    topKeywords: KeywordResult[];
    keywordCount: number;
    avgSerpWeakness: number;
    recommendation: 'build' | 'consider' | 'maybe' | 'skip';
  }

  // Recalculate opportunity for a keyword with new lead value
  function recalculateOpportunity(
    kw: KeywordResult,
    newLeadValue: number
  ): number {
    const volume = kw.metrics?.searchVolume || 0;
    const cpc = kw.metrics?.cpc || 0;
    const difficulty = kw.difficultyScore?.finalDifficulty || 100;
    
    // Recalculate base opportunity (volume adjusted by difficulty)
    const baseOpportunity = volume * (100 - difficulty) / 100;
    
    // CPC multiplier: $10+ CPC = good, lower = okay
    const cpcMultiplier = Math.max(0.5, Math.min(2.0, cpc / 10));
    
    // Lead value multiplier: normalize to $50 baseline
    const leadValueMultiplier = newLeadValue / 50;
    
    // Final opportunity with multipliers
    return baseOpportunity * cpcMultiplier * leadValueMultiplier;
  }

  // Handle lead value change
  const handleLeadValueChange = (cityKey: string, newValue: string) => {
    const numValue = parseFloat(newValue);
    if (!isNaN(numValue) && numValue >= 0) {
      const newMap = new Map(editedLeadValues);
      newMap.set(cityKey, numValue);
      setEditedLeadValues(newMap);
    } else if (newValue === '') {
      // Allow clearing the value to revert to original
      const newMap = new Map(editedLeadValues);
      newMap.delete(cityKey);
      setEditedLeadValues(newMap);
    }
  };

  // Recommendation function
  function getRecommendation(totalOpportunity: number): {
    level: 'build' | 'consider' | 'maybe' | 'skip';
    label: string;
    color: string;
    bgColor: string;
  } {
    if (totalOpportunity >= 1500) {
      return {
        level: 'build',
        label: '🟢 Build Now',
        color: '#155724',
        bgColor: '#d4edda'
      };
    } else if (totalOpportunity >= 800) {
      return {
        level: 'consider',
        label: '🟡 Consider',
        color: '#856404',
        bgColor: '#fff3cd'
      };
    } else if (totalOpportunity >= 500) {
      return {
        level: 'maybe',
        label: '🟠 Maybe',
        color: '#8a6d3b',
        bgColor: '#fcf8e3'
      };
    } else {
      return {
        level: 'skip',
        label: '🔴 Skip',
        color: '#721c24',
        bgColor: '#f8d7da'
      };
    }
  }

  const citiesMap = new Map<string, CityData>();

  for (const kw of filteredKeywords) {
    const cityKey = `${kw.city.city}, ${kw.city.state}`;
    if (!citiesMap.has(cityKey)) {
      citiesMap.set(cityKey, {
        city: kw.city.city,
        state: kw.city.state,
        keywords: [],
        totalOpportunity: 0,
        totalVolume: 0,
        avgDifficulty: 0,
        leadValue: kw.city.payout || 0,
        topKeywords: [],
        keywordCount: 0,
        avgSerpWeakness: 0,
        recommendation: 'skip',
      });
    }
    citiesMap.get(cityKey)!.keywords.push(kw);
  }

  // Calculate aggregates and get top keywords
  for (const cityData of citiesMap.values()) {
    const cityKey = `${cityData.city}, ${cityData.state}`;
    const editedLeadValue = editedLeadValues.get(cityKey);
    
    // Use edited lead value if available, otherwise use original
    if (editedLeadValue !== undefined) {
      cityData.leadValue = editedLeadValue;
    }
    
    cityData.keywordCount = cityData.keywords.length;
    
    // Recalculate opportunity if lead value was edited
    if (editedLeadValue !== undefined) {
      cityData.totalOpportunity = cityData.keywords.reduce(
        (sum, kw) => sum + recalculateOpportunity(kw, editedLeadValue), 0
      );
    } else {
      cityData.totalOpportunity = cityData.keywords.reduce(
        (sum, kw) => sum + (kw.difficultyScore?.opportunity || 0), 0
      );
    }
    
    // Total volume (sum, not average)
    cityData.totalVolume = cityData.keywords.reduce(
      (sum, kw) => sum + (kw.metrics?.searchVolume || 0), 0
    );
    
    // Avg difficulty - only keywords with volume
    const keywordsWithVolume = cityData.keywords.filter(
      kw => (kw.metrics?.searchVolume || 0) > 0
    );
    cityData.avgDifficulty = keywordsWithVolume.length > 0
      ? keywordsWithVolume.reduce(
          (sum, kw) => sum + (kw.difficultyScore?.finalDifficulty || 0), 0
        ) / keywordsWithVolume.length
      : 0;
    
    cityData.avgSerpWeakness = cityData.keywords.reduce(
      (sum, kw) => sum + (kw.difficultyScore?.serpWeakness || 0), 0
    ) / cityData.keywords.length;
    
    // Get top 5 keywords by opportunity (use recalculated if lead value edited)
    const keywordsWithOpportunity = cityData.keywords.map(kw => ({
      ...kw,
      calculatedOpportunity: editedLeadValue !== undefined
        ? recalculateOpportunity(kw, editedLeadValue)
        : (kw.difficultyScore?.opportunity || 0)
    }));
    
    cityData.topKeywords = keywordsWithOpportunity
      .sort((a, b) => b.calculatedOpportunity - a.calculatedOpportunity)
      .slice(0, 5)
      .map(kw => {
        // Remove the temporary calculatedOpportunity field
        const { calculatedOpportunity, ...rest } = kw;
        return rest;
      });
    
    // Calculate recommendation
    const rec = getRecommendation(cityData.totalOpportunity);
    cityData.recommendation = rec.level;
  }

  // Sort cities based on sortBy
  const sortedCities = Array.from(citiesMap.values()).sort((a, b) => {
    switch (sortBy) {
      case 'opportunity':
        return b.totalOpportunity - a.totalOpportunity;
      case 'difficulty':
        return a.avgDifficulty - b.avgDifficulty;
      case 'volume':
        return b.totalVolume - a.totalVolume;
      case 'competition':
        // Higher SERP weakness = weaker competition = better (easier to rank)
        return b.avgSerpWeakness - a.avgSerpWeakness;
      default:
        return b.totalOpportunity - a.totalOpportunity;
    }
  });

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <button
          onClick={() => router.push('/v5000/batches')}
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
          ← Back to Batches
        </button>
        <h1>{batch.name || 'Batch Results'}</h1>
        <p style={{ color: '#666' }}>
          Niche: {batch.niche.name} | Status: <strong>{batch.status.toUpperCase()}</strong>
        </p>
        {keywordStats && (
          <div style={{ 
            marginTop: '1rem', 
            padding: '1rem', 
            backgroundColor: '#f8f9fa', 
            borderRadius: '4px',
            display: 'flex',
            gap: '2rem',
            flexWrap: 'wrap'
          }}>
            <div>
              <strong>Local Keywords:</strong> {keywordStats.local.total} 
              ({keywordStats.local.money} money, {keywordStats.local.supporting} supporting, {keywordStats.local.informational} informational)
            </div>
            <div>
              <strong>National Keywords:</strong> {keywordStats.national.total}
              ({keywordStats.national.money} money, {keywordStats.national.supporting} supporting, {keywordStats.national.informational} informational)
            </div>
            <div>
              <strong>Total Site Pages:</strong> ~{keywordStats.local.total + keywordStats.national.total}
            </div>
          </div>
        )}
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={handleDiscoverNationalKeywords}
            disabled={discoveringNational}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: discoveringNational ? '#6c757d' : '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: discoveringNational ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              opacity: discoveringNational ? 0.6 : 1,
            }}
          >
            {discoveringNational ? '🔍 Discovering National Keywords...' : '🔍 Discover National Keywords'}
          </button>
          <button
            onClick={handleExportKeywords}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            📥 Export All Keywords to Excel
          </button>
        </div>
      </div>

      {batch.status === 'running' && (
        <>
          <div
            style={{
              marginBottom: '1rem',
              padding: '1rem',
              backgroundColor: '#fff3cd',
              borderRadius: '4px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>
              Processing... {batch.processedKeywords} of {batch.totalKeywords} keywords completed
            </span>
            <button
              onClick={handleCancel}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              Stop Batch
            </button>
          </div>

          {batch.processingLog?.entries && batch.processingLog.entries.length > 0 && (
            <div
              style={{
                marginBottom: '1rem',
                padding: '1rem',
                backgroundColor: '#f8f9fa',
                borderRadius: '4px',
                border: '1px solid #dee2e6',
              }}
            >
              <h3 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '1.1rem', fontWeight: 'bold' }}>
                Processing Log
              </h3>
              <div
                id="processing-log-container"
                style={{
                  maxHeight: '400px',
                  overflowY: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  backgroundColor: '#fff',
                  padding: '0.75rem',
                  borderRadius: '4px',
                  border: '1px solid #dee2e6',
                }}
              >
                {batch.processingLog.entries.map((entry, idx) => {
                  const isPassed = entry.status === 'passed';
                  const isFiltered = entry.status === 'filtered';
                  const isChecking = entry.status === 'checking';

                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '0.25rem 0',
                        borderBottom:
                          idx < batch.processingLog!.entries.length - 1 ? '1px solid #e9ecef' : 'none',
                        color: isPassed ? '#28a745' : isFiltered ? '#dc3545' : '#6c757d',
                      }}
                    >
                      {isPassed && '✓ '}
                      {isFiltered && '✗ '}
                      {isChecking && '○ '}
                      <strong>{entry.keyword}</strong>
                      {entry.volume !== null && entry.volume !== undefined && (
                        <span> - Vol: {entry.volume}</span>
                      )}
                      {entry.kd !== null && entry.kd !== undefined && <span>, KD: {entry.kd}</span>}
                      {entry.cpc !== null && entry.cpc !== undefined && (
                        <span>, CPC: ${entry.cpc.toFixed(2)}</span>
                      )}
                      {entry.reason && <span> → {entry.reason}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {batch.status === 'completed' && (
        <>
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <label style={{ marginRight: '0.5rem' }}>Min Volume:</label>
              <input
                type="number"
                value={minVolume}
                onChange={(e) => setMinVolume(e.target.value)}
                style={{ padding: '0.25rem', width: '100px' }}
              />
            </div>
            <div>
              <label style={{ marginRight: '0.5rem' }}>Max Difficulty:</label>
              <input
                type="number"
                value={maxDifficulty}
                onChange={(e) => setMaxDifficulty(e.target.value)}
                style={{ padding: '0.25rem', width: '100px' }}
              />
            </div>
            <div>
              <label style={{ marginRight: '0.5rem' }}>Sort By:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                style={{ padding: '0.25rem' }}
              >
                <option value="opportunity">Total Opportunity</option>
                <option value="competition">Lowest Competition</option>
                <option value="volume">Highest Volume</option>
                <option value="difficulty">Lowest Difficulty</option>
              </select>
            </div>
            <div style={{ marginLeft: 'auto', color: '#666' }}>
              Showing {sortedCities.length} cities ({filteredKeywords.length} keywords)
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ddd', backgroundColor: '#f8f9fa' }}>
                <th style={{ textAlign: 'left', padding: '0.75rem' }}>City</th>
                <th style={{ textAlign: 'right', padding: '0.75rem' }}>Keywords</th>
                <th style={{ textAlign: 'right', padding: '0.75rem' }}>Total Volume</th>
                <th style={{ textAlign: 'right', padding: '0.75rem' }}>Avg Difficulty</th>
                <th style={{ textAlign: 'right', padding: '0.75rem' }}>Total Opportunity</th>
                <th style={{ textAlign: 'left', padding: '0.75rem' }}>Top Keywords</th>
                <th style={{ textAlign: 'center', padding: '0.75rem' }}>Recommendation</th>
                <th style={{ textAlign: 'center', padding: '0.75rem' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {sortedCities.map((cityData) => {
                const cityKey = `${cityData.city}, ${cityData.state}`;
                const isCityExpanded = expandedCities.has(cityKey);

                return (
                  <>
                    <tr
                      key={cityKey}
                      style={{
                        borderBottom: '1px solid #eee',
                        cursor: 'pointer',
                        backgroundColor: isCityExpanded 
                          ? '#f0f8ff' 
                          : cityData.totalOpportunity >= 1500 
                            ? '#f0fff0'  // Light green for build now
                            : 'white',
                        fontWeight: isCityExpanded || cityData.totalOpportunity >= 1500 
                          ? 'bold' 
                          : 'normal',
                      }}
                      onClick={() => toggleCity(cityKey)}
                    >
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span>
                            {cityData.city}, {cityData.state}
                          </span>
                          <input
                            type="number"
                            value={editedLeadValues.get(cityKey) ?? cityData.leadValue}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleLeadValueChange(cityKey, e.target.value);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Lead value"
                            style={{
                              width: '80px',
                              padding: '0.25rem',
                              fontSize: '0.85rem',
                              border: '1px solid #ccc',
                              borderRadius: '3px',
                            }}
                            title="Edit lead value to recalculate opportunity"
                          />
                          <span style={{ fontSize: '0.85rem', color: '#666' }}>
                            /lead
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        {cityData.keywordCount}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        {cityData.totalVolume.toFixed(0)}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        {cityData.avgDifficulty.toFixed(1)}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold' }}>
                        {cityData.totalOpportunity.toFixed(0)}
                      </td>
                      <td style={{ padding: '0.75rem', fontSize: '0.9rem' }}>
                        {cityData.topKeywords.slice(0, 3).map((kw, idx) => {
                          const editedLeadValue = editedLeadValues.get(cityKey);
                          const opportunity = editedLeadValue !== undefined
                            ? recalculateOpportunity(kw, editedLeadValue)
                            : (kw.difficultyScore?.opportunity || 0);
                          return (
                            <span key={kw.id}>
                              {kw.nicheKeyword.keyword} ({opportunity.toFixed(0)})
                              {idx < Math.min(3, cityData.topKeywords.length) - 1 && ', '}
                            </span>
                          );
                        })}
                        {cityData.topKeywords.length > 3 && (
                          <span style={{ color: '#666' }}> +{cityData.topKeywords.length - 3} more</span>
                        )}
                      </td>
                      {(() => {
                        const rec = getRecommendation(cityData.totalOpportunity);
                        return (
                          <td style={{ 
                            padding: '0.75rem',
                            textAlign: 'center',
                            backgroundColor: rec.bgColor,
                            color: rec.color,
                            fontWeight: 'bold'
                          }}>
                            {rec.label}
                          </td>
                        );
                      })()}
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        {isCityExpanded ? '▼' : '▶'}
                      </td>
                    </tr>
                    {isCityExpanded && (
                      <tr key={`${cityKey}-keywords`}>
                        <td colSpan={8} style={{ padding: '1.5rem', backgroundColor: '#f8f9fa' }}>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                              <h4 style={{ marginTop: 0, marginBottom: 0 }}>
                                All Keywords for {cityData.city}, {cityData.state}
                              </h4>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDiscoverKeywords(cityData.city, cityData.state);
                                  }}
                                  disabled={discoveringCities.has(cityKey)}
                                  style={{
                                    padding: '0.5rem 1rem',
                                    backgroundColor: discoveringCities.has(cityKey) ? '#6c757d' : '#007bff',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: discoveringCities.has(cityKey) ? 'not-allowed' : 'pointer',
                                    fontWeight: 'bold',
                                    fontSize: '0.9rem',
                                    opacity: discoveringCities.has(cityKey) ? 0.6 : 1,
                                  }}
                                >
                                  {discoveringCities.has(cityKey) ? '🔍 Discovering...' : '🔍 Find More Keywords'}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleBuildSite(cityData.city, cityData.state, cityData.leadValue);
                                  }}
                                  style={{
                                    padding: '0.5rem 1rem',
                                    backgroundColor: '#28a745',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    fontSize: '0.9rem',
                                  }}
                                >
                                  🏗️ Build Site
                                </button>
                              </div>
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', fontSize: '0.9rem' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid #ddd', backgroundColor: '#e9ecef' }}>
                                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Keyword</th>
                                  <th style={{ textAlign: 'right', padding: '0.5rem' }}>Volume</th>
                                  <th style={{ textAlign: 'right', padding: '0.5rem' }}>CPC</th>
                                  <th style={{ textAlign: 'right', padding: '0.5rem' }}>KD</th>
                                  <th style={{ textAlign: 'right', padding: '0.5rem' }}>Difficulty</th>
                                  <th style={{ textAlign: 'right', padding: '0.5rem' }}>Opportunity</th>
                                  <th style={{ textAlign: 'center', padding: '0.5rem' }}>Details</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(() => {
                                  const editedLeadValue = editedLeadValues.get(cityKey);
                                  return cityData.keywords
                                    .map(kw => ({
                                      ...kw,
                                      calculatedOpportunity: editedLeadValue !== undefined
                                        ? recalculateOpportunity(kw, editedLeadValue)
                                        : (kw.difficultyScore?.opportunity || 0)
                                    }))
                                    .sort((a, b) => b.calculatedOpportunity - a.calculatedOpportunity)
                                    .map((kw) => {
                                      const isExpanded = expandedRows.has(kw.id);
                                      const score = kw.difficultyScore;
                                      const metrics = kw.metrics;
                                      const opportunity = kw.calculatedOpportunity;

                                      return (
                                        <>
                                          <tr
                                            key={kw.id}
                                            style={{
                                              borderBottom: '1px solid #eee',
                                              cursor: 'pointer',
                                              backgroundColor: isExpanded ? '#fff' : 'white',
                                            }}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleRow(kw.id);
                                            }}
                                          >
                                            <td style={{ padding: '0.5rem' }}>{kw.nicheKeyword.keyword}</td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                                              {metrics?.searchVolume || '-'}
                                            </td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                                              {metrics?.cpc ? `$${metrics.cpc.toFixed(2)}` : '-'}
                                            </td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>{metrics?.kd || 'N/A'}</td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                                              {score?.finalDifficulty !== null && score?.finalDifficulty !== undefined
                                                ? score.finalDifficulty.toFixed(1)
                                                : 'N/A'}
                                            </td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                                              {opportunity.toFixed(1)}
                                            </td>
                                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                              {isExpanded ? '▼' : '▶'}
                                            </td>
                                          </tr>
                                        {isExpanded && score && (
                                          <tr key={`${kw.id}-details`}>
                                            <td colSpan={7} style={{ padding: '1rem', backgroundColor: '#fff' }}>
                                              <div style={{ fontSize: '0.85rem' }}>
                                                <h5 style={{ marginTop: 0 }}>Full Math Breakdown</h5>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                                                  <div>
                                                    <strong>SERP Weakness:</strong> {score.serpWeakness?.toFixed(1) || 'N/A'}
                                                    <br />
                                                    <strong>Local Pack Strength:</strong> {score.localPackStrength?.toFixed(1) || 'N/A'}
                                                    <br />
                                                    <strong>On-Page Competence:</strong> {score.onpageCompetence?.toFixed(1) || 'N/A'}
                                                  </div>
                                                  <div>
                                                    <strong>Lead Value:</strong> ${(editedLeadValue !== undefined ? editedLeadValue : (kw.leadValue || 0)).toFixed(2)}
                                                    <br />
                                                    <strong>CPC Multiplier:</strong> {score.cpcMultiplier?.toFixed(2) || 'N/A'}
                                                    <br />
                                                    <strong>Lead Value Multiplier:</strong> {((editedLeadValue !== undefined ? editedLeadValue : (kw.leadValue || 0)) / 50).toFixed(2)}
                                                  </div>
                                                </div>
                                                <div style={{ marginTop: '0.75rem', padding: '0.75rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                                                  <strong>Difficulty Calculation:</strong>
                                                  <br />
                                                  KD({metrics?.kd || 'N/A'}) × 0.6 = {score.kdComponent?.toFixed(1) || 'N/A'}
                                                  <br />
                                                  SerpDiff({score.serpDifficulty?.toFixed(1) || 'N/A'}) × 0.25 = {score.serpComponent?.toFixed(1) || 'N/A'}
                                                  <br />
                                                  Pack({score.localPackStrength?.toFixed(1) || 'N/A'}) × 0.15 = {score.packComponent?.toFixed(1) || 'N/A'}
                                                  <br />
                                                  <strong>Total Difficulty: {score.finalDifficulty?.toFixed(1) || 'N/A'}</strong>
                                                </div>
                                                <div style={{ marginTop: '0.75rem', padding: '0.75rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                                                  <strong>Opportunity Calculation:</strong>
                                                  <br />
                                                  Volume({metrics?.searchVolume || 0}) × (100 - {score.finalDifficulty?.toFixed(1) || 'N/A'}) / 100 = {score.baseOpportunity?.toFixed(1) || 'N/A'}
                                                  <br />
                                                  × CPCMult({score.cpcMultiplier?.toFixed(2) || 'N/A'}) × LeadMult({((editedLeadValue !== undefined ? editedLeadValue : (kw.leadValue || 0)) / 50).toFixed(2)})
                                                  <br />
                                                  <strong>= {opportunity.toFixed(1)}</strong>
                                                  {editedLeadValue !== undefined && (
                                                    <span style={{ color: '#666', fontSize: '0.8rem', marginLeft: '0.5rem' }}>
                                                      (recalculated)
                                                    </span>
                                                  )}
                                                </div>
                                                <div style={{ marginTop: '0.75rem' }}>
                                                  <a
                                                    href={`https://www.google.com/search?q=${encodeURIComponent(kw.localizedQuery)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{ color: '#0070f3' }}
                                                  >
                                                    View SERP on Google →
                                                  </a>
                                                </div>
                                              </div>
                                            </td>
                                          </tr>
                                        )}
                                      </>
                                    );
                                  });
                                })()}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}


