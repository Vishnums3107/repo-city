import React, { useState } from 'react';

interface RepoLoaderProps {
  onLoad: (repoUrl: string, token?: string) => void;
  loading: boolean;
  error: string | null;
}

export const RepoLoader: React.FC<RepoLoaderProps> = ({ onLoad, loading, error }) => {
  const [repoUrl, setRepoUrl] = useState('facebook/react');
  const [token, setToken] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLoad(repoUrl, token);
  };

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 100,
      background: 'rgba(5, 5, 10, 0.9)',
      border: '1px solid #00ffff',
      padding: '40px',
      borderRadius: '8px',
      boxShadow: '0 0 20px rgba(0, 255, 255, 0.3)',
      color: '#fff',
      fontFamily: 'monospace',
      width: '400px',
      textAlign: 'center'
    }}>
      <h2 style={{ color: '#00ffff', textShadow: '0 0 5px #00ffff', marginBottom: '20px' }}>
        REPO-CITY ACCESS TERMINAL
      </h2>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div>
          <label style={{ display: 'block', textAlign: 'left', marginBottom: '5px', color: '#888' }}>Target Repository</label>
          <input 
            type="text" 
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="owner/repo"
            style={{
              width: '100%',
              padding: '10px',
              background: '#111',
              border: '1px solid #333',
              color: '#fff',
              fontFamily: 'monospace'
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', textAlign: 'left', marginBottom: '5px', color: '#888' }}>
            Access Token <span style={{fontSize: '10px'}}>(Optional, for rate limits)</span>
          </label>
          <input 
            type="password" 
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ghp_..."
            style={{
              width: '100%',
              padding: '10px',
              background: '#111',
              border: '1px solid #333',
              color: '#fff',
              fontFamily: 'monospace'
            }}
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          style={{
            marginTop: '10px',
            padding: '12px',
            background: loading ? '#333' : '#00ffff',
            color: loading ? '#888' : '#000',
            border: 'none',
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}
        >
          {loading ? 'HACKING MAINFRAME...' : 'INITIALIZE VISUALIZATION'}
        </button>
      </form>

      {error && (
        <div style={{ marginTop: '20px', color: '#ff3333', border: '1px solid #ff3333', padding: '10px', fontSize: '12px' }}>
          ERROR: {error}
        </div>
      )}
      
      <div style={{ marginTop: '20px', fontSize: '10px', color: '#444' }}>
        SYSTEM STATUS: ONLINE<br/>
        V.5.0.0 [PHASE 5]
      </div>
    </div>
  );
};
