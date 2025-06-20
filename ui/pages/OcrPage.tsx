import React, { useState, useRef } from 'react';
import axios from 'axios';
import { EngineSelector } from '../components/EngineSelector';
import { DocumentTypeSelector } from '../components/DocumentTypeSelector';
import { AdvancedSettingsPanel } from '../components/AdvancedSettingsPanel';
import { ResultsViewer } from '../components/ResultsViewer';

export const OcrPage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<string>('');
  const [selectedEngine, setSelectedEngine] = useState<string>('');
  const [isAdvancedOpen, setIsAdvancedOpen] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [advancedSettings, setAdvancedSettings] = useState({
    enhanceResolution: false,
    confidenceThreshold: 0.5,
    preserveLayout: true,
    enableConfidenceAnalysis: false,
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
      setError('');
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file to process');
      return;
    }
    
    setIsProcessing(true);
    setError('');
    
    const formData = new FormData();
    formData.append('image', file);
    
    try {
      let endpoint = '/api/ocr';
      
      // Use specialized endpoints based on document type
      if (documentType) {
        endpoint = `/api/ocr/${documentType}`;
      }
      
      // If specific engine is selected, use engine-specific endpoint
      if (selectedEngine) {
        endpoint = `/api/ocr/engine/${selectedEngine}`;
        formData.append('documentType', documentType);
      }
      
      // Add advanced settings to request
      Object.entries(advancedSettings).forEach(([key, value]) => {
        formData.append(key, String(value));
      });
      
      const response = await axios.post(endpoint, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setResult(response.data);
    } catch (err) {
      setError('Error processing document: ' + (err instanceof Error ? err.message : String(err)));
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };
  
  return (
    <div className="ocr-page">
      <header className="page-header">
        <h1>Document Recognition System</h1>
        <p className="subtitle">Featuring nanoVLM-222M for enhanced accuracy</p>
      </header>
      
      <div className="main-container">
        <form onSubmit={handleSubmit} className="ocr-form">
          <div className="file-upload-section">
            <div 
              className="file-drop-area"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  setFile(e.dataTransfer.files[0]);
                  setResult(null);
                  setError('');
                }
              }}
            >
              {file ? (
                <div className="file-preview">
                  <p>{file.name}</p>
                  {file.type.startsWith('image/') && (
                    <img 
                      src={URL.createObjectURL(file)} 
                      alt="Preview" 
                      className="file-preview-image" 
                    />
                  )}
                </div>
              ) : (
                <div className="upload-prompt">
                  <i className="upload-icon">📄</i>
                  <p>Drag & drop a file or click to browse</p>
                </div>
              )}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*,.pdf"
                style={{ display: 'none' }}
              />
            </div>
          </div>
          
          <DocumentTypeSelector 
            onChange={setDocumentType}
            initialValue={documentType}
          />
          
          <EngineSelector 
            onSelect={setSelectedEngine} 
            documentType={documentType}
          />
          
          <div className="advanced-settings-toggle">
            <button 
              type="button" 
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
              className="text-button"
            >
              {isAdvancedOpen ? 'Hide' : 'Show'} Advanced Settings
            </button>
          </div>
          
          {isAdvancedOpen && (
            <AdvancedSettingsPanel 
              settings={advancedSettings}
              onChange={setAdvancedSettings}
            />
          )}
          
          <div className="form-actions">
            <button 
              type="submit" 
              className="primary-button"
              disabled={isProcessing || !file}
            >
              {isProcessing ? 'Processing...' : 'Process Document'}
            </button>
          </div>
          
          {error && <div className="error-message">{error}</div>}
        </form>
        
        {result && (
          <div className="results-section">
            <h2>Recognition Results</h2>
            <ResultsViewer result={result} />
          </div>
        )}
      </div>
    </div>
  );
};
