/**
 * Multi-engine OCR implementation with basic text enhancement
 */

import { createWorker } from 'tesseract.js';

export class multiEngineOCR {
    constructor(options = {}) {
        this.confidence = options.confidence || 0.85;
        this.worker = null;
    }

    async initialize() {
        if (!this.worker) {
            this.worker = await createWorker();
            await this.worker.loadLanguage('eng');
            await this.worker.initialize('eng');
            console.log('OCR engine initialized');
        }
    }

    async processDocument(inputPath) {
        await this.initialize();
        
        console.log('Processing document:', inputPath);
        const startTime = Date.now();
        
        try {
            // Perform base OCR
            const ocrResults = await this.performOCR(inputPath);
            const processingTime = Date.now() - startTime;
            
            return {
                ...ocrResults,
                processingTime,
                enhancedText: this.enhanceText(ocrResults.text)
            };
        } catch (error) {
            console.error('Error processing document:', error);
            throw error;
        }
    }

    async performOCR(inputPath) {
        console.log('Performing OCR...');
        const { data } = await this.worker.recognize(inputPath);
        
        return {
            text: data.text,
            confidence: data.confidence,
            blocks: data.blocks,
            success: true
        };
    }

    enhanceText(text) {
        // Basic text enhancement rules
        return text
            .replace(/\s+/g, ' ')  // normalize whitespace
            .replace(/[^\S\n]+/g, ' ')  // normalize spaces but keep newlines
            .replace(/([.!?])\s*(?=\S)/g, '$1 ')  // ensure space after punctuation
            .trim();
    }

    async cleanup() {
        if (this.worker) {
            await this.worker.terminate();
            this.worker = null;
        }
    }
}
