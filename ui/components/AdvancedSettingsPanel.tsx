import React from 'react';

interface AdvancedSettings {
  enhanceResolution: boolean;
  confidenceThreshold: number;
  preserveLayout: boolean;
}

interface AdvancedSettingsPanelProps {
  settings: AdvancedSettings;
  onChange: (settings: AdvancedSettings) => void;
}

export const AdvancedSettingsPanel: React.FC<AdvancedSettingsPanelProps> = ({ 
  settings, 
  onChange 
}) => {
  const handleChangeSetting = (
    settingName: keyof AdvancedSettings,
    value: string | boolean | number
  ) => {
    onChange({
      ...settings,
      [settingName]: value
    });
  };

  return (
    <div className="advanced-settings-panel">
      <h3>Advanced Settings</h3>
      
      <div className="setting-group">
        <label>
          <input
            type="checkbox"
            checked={settings.enhanceResolution}
            onChange={e => handleChangeSetting('enhanceResolution', e.target.checked)}
          />
          Enhance Resolution
        </label>
        <p className="setting-description">
          Improves recognition of poor quality images through super-resolution
        </p>
      </div>
      
      <div className="setting-group">
        <label>
          <input
            type="checkbox"
            checked={settings.preserveLayout}
            onChange={e => handleChangeSetting('preserveLayout', e.target.checked)}
          />
          Preserve Document Layout
        </label>
        <p className="setting-description">
          Maintains original document structure including columns and tables
        </p>
      </div>
      
      <div className="setting-group">
        <label>
          Confidence Threshold: {settings.confidenceThreshold.toFixed(1)}
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={settings.confidenceThreshold}
          onChange={e => handleChangeSetting('confidenceThreshold', parseFloat(e.target.value))}
          className="slider"
        />
        <div className="slider-labels">
          <span>Low (More Text)</span>
          <span>High (More Accurate)</span>
        </div>
        <p className="setting-description">
          Adjusts the minimum confidence level for text to be included in results
        </p>
      </div>
      
      <div className="nano-vlm-info">
        <h4>About nanoVLM Model</h4>
        <p>
          nanoVLM-222M is a vision-language model that excels at processing challenging documents
          including handwritten text, tables, and low-quality images.
        </p>
      </div>
    </div>
  );
};
