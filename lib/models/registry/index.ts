import { ModelMetadata } from './types';

export const modelRegistry: Record<string, ModelMetadata> = {
  'nanovlm-222m': {
    id: 'nanovlm-222m',
    name: 'NanoVLM-222M',
    version: '1.0.0',
    source: 'huggingface',
    repository: 'lusxvr/nanoVLM-222M',
    capabilities: {
      handwriting: true,
      tables: true,
      medical: true,
      languages: ['en']
    },
    requirements: {
      memory: 1024,
      diskSpace: 500,
      gpu: false
    }
  }
};

export default modelRegistry;
