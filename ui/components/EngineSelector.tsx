import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface Engine {
  name: string;
  available: boolean;
  specialization: string[];
  displayName?: string;
}

interface EngineSelectorProps {
  onSelect: (engineName: string) => void;
  documentType?: string;
}

export const EngineSelector: React.FC<EngineSelectorProps> = ({ onSelect, documentType }) => {
  const [engines, setEngines] = useState<Engine[]>([]);
  const [selectedEngine, setSelectedEngine] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // For development, ensure nanoVLM is always an option even if API isn't responding
    const defaultEngines = [
      {
        name: 'nanovlm',
        available: true,
        specialization: ['handwriting', 'tables', 'poor_quality'],
        displayName: 'nanoVLM (Advanced AI)'
      },
      {
        name: 'tesseract',
        available: true,
        specialization: ['general'],
        displayName: 'Tesseract OCR'
      }
    ];

    // Try to fetch from API, but use defaults if that fails
    axios.get('/api/engines')
      .then(response => {
        setEngines(response.data);
        
        // Auto-select based on document type if provided
        if (documentType && response.data.length > 0) {
          const matchingEngine = response.data.find(
            (engine: Engine) => engine.specialization.includes(documentType) && engine.available
          );
          
          if (matchingEngine) {
            setSelectedEngine(matchingEngine.name);
            onSelect(matchingEngine.name);
          } else {
            // Default to first available engine
            const defaultEngine = response.data.find((engine: Engine) => engine.available);
            if (defaultEngine) {
              setSelectedEngine(defaultEngine.name);
              onSelect(defaultEngine.name);
            }
          }
        }
        
        setLoading(false);
      })
      .catch(err => {
        console.warn('Failed to load engines from API, using defaults', err);
        setEngines(defaultEngines);
        
        // Default to nanoVLM for specialized document types
        if (documentType && (documentType === 'handwriting' || 
            documentType === 'table' || 
            documentType === 'poor_quality')) {
          setSelectedEngine('nanovlm');
          onSelect('nanovlm');
        } else {
          setSelectedEngine('tesseract');
          onSelect('tesseract');
        }
        
        setLoading(false);
      });
  }, [documentType, onSelect]);

  const handleEngineChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const engineName = event.target.value;
    setSelectedEngine(engineName);
    onSelect(engineName);
  };

  if (loading) return <div>Loading engines...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="engine-selector">
      <label htmlFor="engine-select">OCR Engine:</label>
      <select
        id="engine-select"
        value={selectedEngine}
        onChange={handleEngineChange}
        className="engine-select-dropdown"
      >
        <option value="">Select an engine</option>
        {engines
          .filter(engine => engine.available)
          .map(engine => (
            <option key={engine.name} value={engine.name}>
              {engine.displayName || engine.name} {engine.specialization.length > 0 && 
                !engine.displayName && `(${engine.specialization.join(', ')})`}
            </option>
          ))}
      </select>
      
      {selectedEngine === 'nanovlm' && (
        <div className="engine-info">
          <p>Using nanoVLM for advanced document processing with AI-enhanced accuracy</p>
          <p className="hint">Best for handwritten text, tables, and poor quality images</p>
        </div>
      )}
    </div>
  );
};
