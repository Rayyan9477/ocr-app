import React from 'react';

interface DocumentTypeSelectorProps {
  onChange: (documentType: string) => void;
  initialValue?: string;
}

export const DocumentTypeSelector: React.FC<DocumentTypeSelectorProps> = ({ onChange, initialValue = '' }) => {
  const documentTypes = [
    { id: 'general', label: 'General Document' },
    { id: 'handwritten', label: 'Handwritten Text' },
    { id: 'table', label: 'Table/Spreadsheet' },
    { id: 'poor_quality', label: 'Poor Quality Image' },
    { id: 'complex_layout', label: 'Complex Layout Document' },
    { id: 'form', label: 'Form' }
  ];

  return (
    <div className="document-type-selector">
      <h3>Document Type</h3>
      <p className="help-text">Select the type of document you're processing to improve accuracy</p>
      
      <div className="document-types-grid">
        {documentTypes.map(type => (
          <div key={type.id} className="document-type-option">
            <input
              type="radio"
              id={`doc-type-${type.id}`}
              name="document-type"
              value={type.id}
              checked={initialValue === type.id}
              onChange={() => onChange(type.id)}
            />
            <label htmlFor={`doc-type-${type.id}`}>{type.label}</label>
          </div>
        ))}
      </div>
      
      <div className="document-type-info">
        {initialValue === 'handwritten' && (
          <p>Handwritten text uses specialized recognition for cursive writing and personal notes.</p>
        )}
        {initialValue === 'table' && (
          <p>Table mode preserves structure and relationships between cells.</p>
        )}
        {initialValue === 'poor_quality' && (
          <p>Poor quality mode applies enhancement algorithms before processing.</p>
        )}
      </div>
    </div>
  );
};
