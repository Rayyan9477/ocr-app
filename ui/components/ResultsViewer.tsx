import React, { useState } from 'react';

interface ResultsViewerProps {
  result: {
    text: string;
    confidence: number;
    processingTime: number;
    structuredData?: any;
    layout?: any[];
  };
}

export const ResultsViewer: React.FC<ResultsViewerProps> = ({ result }) => {
  const [viewMode, setViewMode] = useState<'text' | 'structured' | 'layout'>('text');
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(result.text);
  };
  
  return (
    <div className="results-viewer">
      <div className="results-header">
        <div className="results-tabs">
          <button 
            className={`tab-button ${viewMode === 'text' ? 'active' : ''}`}
            onClick={() => setViewMode('text')}
          >
            Text
          </button>
          {result.structuredData && (
            <button 
              className={`tab-button ${viewMode === 'structured' ? 'active' : ''}`}
              onClick={() => setViewMode('structured')}
            >
              Structured Data
            </button>
          )}
          {result.layout && (
            <button 
              className={`tab-button ${viewMode === 'layout' ? 'active' : ''}`}
              onClick={() => setViewMode('layout')}
            >
              Layout
            </button>
          )}
        </div>
        
        <div className="results-actions">
          <button 
            className="icon-button"
            onClick={copyToClipboard}
            title="Copy to clipboard"
          >
            📋
          </button>
          <button 
            className="icon-button"
            onClick={() => {
              const blob = new Blob([viewMode === 'text' ? result.text : JSON.stringify(result.structuredData || result.layout, null, 2)], 
                { type: 'text/plain;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'ocr-result.txt';
              a.click();
            }}
            title="Download as text file"
          >
            💾
          </button>
        </div>
      </div>
      
      <div className="results-metadata">
        <div className="metadata-item">
          <span>Confidence:</span> {(result.confidence * 100).toFixed(1)}%
        </div>
        <div className="metadata-item">
          <span>Processing Time:</span> {result.processingTime}ms
        </div>
      </div>
      
      <div className="results-content">
        {viewMode === 'text' && (
          <div className="text-result">
            <pre>{result.text}</pre>
          </div>
        )}
        
        {viewMode === 'structured' && result.structuredData && (
          <div className="structured-result">
            {result.structuredData.table && (
              <table className="data-table">
                <tbody>
                  {result.structuredData.table.map((row: string[], rowIndex: number) => (
                    <tr key={rowIndex}>
                      {row.map((cell: string, cellIndex: number) => (
                        <td key={cellIndex}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!result.structuredData.table && (
              <pre>{JSON.stringify(result.structuredData, null, 2)}</pre>
            )}
          </div>
        )}
        
        {viewMode === 'layout' && result.layout && (
          <div className="layout-result">
            <pre>{JSON.stringify(result.layout, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
};
