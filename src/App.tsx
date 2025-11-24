import { useEffect, useState } from 'react';
import './App.css';
import { useTreeSitter } from './hooks/useTreeSitter';
import { parseCode, extractDependencies } from './utils/parser';
import { generateCityLayout, type CityNode } from './utils/layoutEngine';
import { CityScene } from './components/CityScene';
import { useRepoFetcher } from './hooks/useRepoFetcher';
import { RepoLoader } from './components/RepoLoader';
import { AudioProvider, useCyberSound } from './components/AudioManager';

const sampleCodeJS = `
import React from 'react';
import { useState } from 'react';
const x = require('fs');

function hello() {
  console.log("Hello World");
}
`;

const sampleCodeCPP = `
#include <iostream>
#include "my_header.h"

int main() {
    std::cout << "Hello World";
    return 0;
}
`;

// Wrapper component to handle audio initialization from RepoLoader
const RepoLoaderWithAudio: React.FC<{ onLoad: (url: string, token?: string) => void, loading: boolean, error: string | null }> = (props) => {
    const { initializeAudio } = useCyberSound();
    
    const handleLoad = (url: string, token?: string) => {
        initializeAudio();
        props.onLoad(url, token);
    };

    return <RepoLoader {...props} onLoad={handleLoad} />;
};

function AppContent() {
  // We can use the hook for JS
  const { parser: parserJS, loading: loadingJS, error: errorJS } = useTreeSitter('/tree-sitter-javascript.wasm');
  // And for CPP (in a real app we might load dynamically)
  const { parser: parserCPP, loading: loadingCPP, error: errorCPP } = useTreeSitter('/tree-sitter-cpp.wasm');

  const { fetchRepo, loading: repoLoading, error: repoError, data: repoData } = useRepoFetcher();
  const [cityLayout, setCityLayout] = useState<CityNode[]>([]);
  const [generating, setGenerating] = useState(false);
  const [token, setToken] = useState<string>('');

  const [depsJS, setDepsJS] = useState<string[]>([]);
  const [depsCPP, setDepsCPP] = useState<string[]>([]);

  const handleRepoLoad = (url: string, t?: string) => {
      if (t) setToken(t);
      fetchRepo(url, t);
  };

  const fetchFileContent = async (node: CityNode): Promise<string> => {
      if (!node.url) return "// No URL for this file.";
      
      try {
          const headers: HeadersInit = {
              'Accept': 'application/vnd.github.v3.raw' // Request raw content
          };
          if (token) {
              headers['Authorization'] = `token ${token}`;
          }
          
          const res = await fetch(node.url, { headers });
          if (!res.ok) throw new Error(res.statusText);
          return await res.text();
      } catch (e: any) {
          return `// Failed to fetch: ${e.message}`;
      }
  };

  useEffect(() => {
    if (repoData) {
      setGenerating(true);
      // Yield to main thread to allow UI to render "Generating..."
      setTimeout(() => {
        const layout = generateCityLayout(repoData);
        setCityLayout(layout);
        setGenerating(false);
      }, 50);
    }
  }, [repoData]);

  useEffect(() => {
    if (parserJS && !loadingJS) {
      const root = parseCode(sampleCodeJS, parserJS);
      setDepsJS(extractDependencies(root));
    }
  }, [parserJS, loadingJS]);

  useEffect(() => {
    if (parserCPP && !loadingCPP) {
      const root = parseCode(sampleCodeCPP, parserCPP);
      setDepsCPP(extractDependencies(root));
    }
  }, [parserCPP, loadingCPP]);

  if (loadingJS || loadingCPP) return <div>Loading Tree Sitter...</div>;
  if (errorJS) return <div>Error JS: {errorJS.message}</div>;
  if (errorCPP) return <div>Error CPP: {errorCPP.message}</div>;

  if (!repoData) {
    return <RepoLoaderWithAudio onLoad={handleRepoLoad} loading={repoLoading} error={repoError} />;
  }

  return (
    <div className="App">
      <h1>Repo-City Parser & Layout Test</h1>
      
      <div style={{ marginBottom: '40px', border: '1px solid #444', padding: '20px', borderRadius: '8px' }}>
        <h2>City Layout Generation </h2>
        {generating ? (
            <p style={{ color: '#00ffff' }}>Generating City Layout... (This may take a moment)</p>
        ) : (
            <p>Generated {cityLayout.length} nodes from {repoData.name}.</p>
        )}
        
        {!generating && cityLayout.length > 0 && (
            <CityScene layout={cityLayout} connections={[]} onFetchCode={fetchFileContent} />
        )}
      </div>

      <div style={{ display: 'flex', gap: '40px' }}>
        {/* JS Section */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'flex-start' }}>
          <h2>JavaScript Parser</h2>
          <div style={{ width: '100%' }}>
            <h3>Sample Code</h3>
            <pre style={{ textAlign: 'left', background: '#222', padding: '10px', borderRadius: '5px' }}>{sampleCodeJS}</pre>
          </div>
          
          <div style={{ width: '100%' }}>
            <h3>Extracted Dependencies</h3>
            <ul style={{ textAlign: 'left' }}>
              {depsJS.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          </div>
        </div>

        {/* CPP Section */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'flex-start' }}>
          <h2>C++ Parser</h2>
          <div style={{ width: '100%' }}>
            <h3>Sample Code</h3>
            <pre style={{ textAlign: 'left', background: '#222', padding: '10px', borderRadius: '5px' }}>{sampleCodeCPP}</pre>
          </div>
          
          <div style={{ width: '100%' }}>
            <h3>Extracted Dependencies</h3>
            <ul style={{ textAlign: 'left' }}>
              {depsCPP.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
    return (
        <AudioProvider>
            <AppContent />
        </AudioProvider>
    );
}

export default App;
