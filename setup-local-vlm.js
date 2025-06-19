#!/usr/bin/env node

/**
 * Script to setup Paligemma2 VLM model locally using transformers.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AutoModel, AutoProcessor } from '@xenova/transformers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use Microsoft's TrOCR model which is better supported by transformers.js
const MODEL_ID = 'microsoft/trocr-base-handwritten';
const MODEL_CACHE_DIR = path.join(__dirname, 'models', 'trocr');

async function ensureModelDir() {
    if (!fs.existsSync(MODEL_CACHE_DIR)) {
        fs.mkdirSync(MODEL_CACHE_DIR, { recursive: true });
    }
}

async function downloadModel() {
    console.log(`Downloading ${MODEL_ID} model...`);
    try {
        // Set cache directory for transformers.js
        process.env.TRANSFORMERS_CACHE = MODEL_CACHE_DIR;

        // Initialize model and processor
        console.log('Initializing model and processor...');
        
        // For TrOCR, we need VisionEncoderDecoderModel and TrOCRProcessor
        const { VisionEncoderDecoderModel, TrOCRProcessor } = await import('@xenova/transformers');
        
        const [model, processor] = await Promise.all([
            VisionEncoderDecoderModel.from_pretrained(MODEL_ID),
            TrOCRProcessor.from_pretrained(MODEL_ID)
        ]);

        console.log('Model and processor downloaded successfully!');
        console.log('Model files cached in:', MODEL_CACHE_DIR);
        return { model, processor };
    } catch (error) {
        console.error('Error downloading model:', error);
        
        // Fallback to a simpler model if the main one fails
        console.log('Trying fallback model: microsoft/trocr-base-printed');
        try {
            const { VisionEncoderDecoderModel, TrOCRProcessor } = await import('@xenova/transformers');
            const [model, processor] = await Promise.all([
                VisionEncoderDecoderModel.from_pretrained('microsoft/trocr-base-printed'),
                TrOCRProcessor.from_pretrained('microsoft/trocr-base-printed')
            ]);
            console.log('Fallback model downloaded successfully!');
            return { model, processor };
        } catch (fallbackError) {
            console.error('Fallback model also failed:', fallbackError);
            throw error;
        }
        throw error;
    }
}

export async function setupLocalVLM() {
    try {
        await ensureModelDir();
        await downloadModel();
        console.log('VLM setup completed successfully!');
    } catch (error) {
        console.error('Error during VLM setup:', error);
        process.exit(1);
    }
}

// Run setup if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    setupLocalVLM();
}
