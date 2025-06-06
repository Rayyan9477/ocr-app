import { MultiEngineOCR } from '../multi-engine-ocr';
import { NanoVLMService } from './nanovlm-service';
import logger from '../logger';

export class NanoVLMIntegration {
    private nanovlm: NanoVLMService;
    private multiEngine: MultiEngineOCR;

    constructor(multiEngine: MultiEngineOCR) {
        this.multiEngine = multiEngine;
        this.nanovlm = new NanoVLMService();
    }

    async initialize(): Promise<void> {
        try {
            await this.nanovlm.initialize();
            logger.info('NanoVLM integration initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize NanoVLM:', error);
            throw error;
        }
    }

    async isAvailable(): Promise<boolean> {
        try {
            await this.initialize();
            return true;
        } catch {
            return false;
        }
    }

    getService(): NanoVLMService {
        return this.nanovlm;
    }
}
