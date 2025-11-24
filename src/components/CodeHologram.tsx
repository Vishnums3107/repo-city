import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeHologramProps {
  isOpen: boolean;
  onClose: () => void;
  code: string;
  fileName: string;
}

export const CodeHologram: React.FC<CodeHologramProps> = ({ isOpen, onClose, code, fileName }) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'rgba(0, 0, 0, 0.6)', // Dim background
      zIndex: 1000,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      backdropFilter: 'blur(2px)'
    }} onClick={onClose}>
      <div style={{
        width: '80%',
        maxWidth: '900px',
        height: '80%',
        background: 'rgba(10, 20, 30, 0.85)', // Glass dark blue
        border: '1px solid #00ffff',
        borderRadius: '8px',
        boxShadow: '0 0 20px rgba(0, 255, 255, 0.4), inset 0 0 20px rgba(0, 255, 255, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backdropFilter: 'blur(10px)',
        transform: 'perspective(1000px) rotateX(2deg)', // Slight 3D tilt for "hologram" feel
        transition: 'transform 0.3s ease'
      }} onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{
          padding: '15px',
          borderBottom: '1px solid #00ffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(0, 255, 255, 0.1)'
        }}>
          <h3 style={{ 
            margin: 0, 
            color: '#00ffff', 
            fontFamily: 'monospace', 
            textShadow: '0 0 5px #00ffff',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span style={{ fontSize: '1.2em' }}>📄</span> {fileName}
          </h3>
          <button 
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid #ff0055',
              color: '#ff0055',
              padding: '5px 10px',
              cursor: 'pointer',
              fontFamily: 'monospace',
              fontWeight: 'bold',
              boxShadow: '0 0 5px #ff0055'
            }}
          >
            CLOSE [X]
          </button>
        </div>

        {/* Code Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '0',
          background: 'rgba(0, 0, 0, 0.5)'
        }}>
          <SyntaxHighlighter 
            language={fileName.endsWith('.tsx') || fileName.endsWith('.ts') ? 'typescript' : 'javascript'} 
            style={vscDarkPlus}
            customStyle={{
              margin: 0,
              padding: '20px',
              background: 'transparent',
              fontSize: '14px',
              lineHeight: '1.5',
              textShadow: '0 0 2px rgba(255,255,255,0.3)' // Slight glow to text
            }}
            showLineNumbers={true}
          >
            {code || '// No content available'}
          </SyntaxHighlighter>
        </div>

        {/* Footer Status Bar */}
        <div style={{
          padding: '5px 15px',
          borderTop: '1px solid #00ffff',
          background: 'rgba(0, 20, 40, 0.9)',
          color: '#00ffff',
          fontSize: '12px',
          fontFamily: 'monospace',
          display: 'flex',
          justifyContent: 'space-between'
        }}>
          <span>STATUS: READ_ONLY</span>
          <span>ENCRYPTION: NONE</span>
          <span>LINES: {code ? code.split('\n').length : 0}</span>
        </div>
      </div>
    </div>
  );
};
