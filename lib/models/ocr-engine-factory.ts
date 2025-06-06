import { NanoVLMIntegration } from './nanovlm-integration';
import { MultiEngineOCR } from '../multi-engine-ocr';
import logger from '../logger';

export class OCREngineFactory {
    private static instance: OCREngineFactory;
    private multiEngine: MultiEngineOCR;
    private nanovlmIntegration?: NanoVLMIntegration;

    private constructor() {
        this.multiEngine = new MultiEngineOCR();
    }

    static getInstance(): OCREngineFactory {
        if (!OCREngineFactory.instance) {
            OCREngineFactory.instance = new OCREngineFactory();
        }
        return OCREngineFactory.instance;
    }

    async initializeNanoVLM(): Promise<boolean> {
        try {
            if (!this.nanovlmIntegration) {
                this.nanovlmIntegration = new NanoVLMIntegration(this.multiEngine);
            }
            await this.nanovlmIntegration.initialize();
            return true;
        } catch (error) {
            logger.warn('Failed to initialize NanoVLM:', error);
            return false;
        }
    }

    async getPreferredEngine(documentType: string): Promise<string> {
        // Try NanoVLM for specific document types
        if (['handwriting', 'medical', 'complex'].includes(documentType)) {
            const nanovlmAvailable = await this.initializeNanoVLM();
            if (nanovlmAvailable) {
                return 'nanovlm';
            }
        }
        
        // Fall back to default engine
        return 'ocrmypdf';
    }

    getMultiEngine(): MultiEngineOCR {
        return this.multiEngine;
    }

    getNanoVLM(): NanoVLMIntegration | undefined {
        return this.nanovlmIntegration;
    }
}
