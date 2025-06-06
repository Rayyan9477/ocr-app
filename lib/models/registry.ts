export interface ModelMetadata {
  id: string;
  name: string;
  version: string;
  source: 'huggingface' | 'local';
  repository?: string;
  capabilities: {
    handwriting: boolean;
    tables: boolean;
    medical: boolean;
    languages: string[];
  };
  requirements: {
    memory: number;  // MB
    diskSpace: number;  // MB
    gpu?: boolean;
  };
}

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
