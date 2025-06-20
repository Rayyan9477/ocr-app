#!/usr/bin/env node

/**
 * Script to setup PaliGemma2 VLM model locally using Hugging Face transformers
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PaliGemma2Simple from './lib/paligemma2-simple.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use PaliGemma2 ONNX model
const MODEL_ID = 'NSTiwari/paligemma2-3b-mix-224-onnx';
const MODEL_CACHE_DIR = path.join(__dirname, 'models', 'paligemma2');

async function ensureModelDir() {
    if (!fs.existsSync(MODEL_CACHE_DIR)) {
        fs.mkdirSync(MODEL_CACHE_DIR, { recursive: true });
    }
}

async function downloadModel() {
    console.log(`Downloading ${MODEL_ID} model...`);
    try {
        // Set cache directory
        process.env.TRANSFORMERS_CACHE = MODEL_CACHE_DIR;

        // Initialize PaliGemma2 model
        console.log('Initializing PaliGemma2 model...');
        
        const paligemma2 = new PaliGemma2Simple();
        const success = await paligemma2.initialize();

        if (success) {
            console.log('✅ PaliGemma2 model downloaded and initialized successfully!');
        } else {
            console.log('⚠️ PaliGemma2 model downloaded with warnings (processor only)');
        }
        
        console.log('Model files cached in:', MODEL_CACHE_DIR);
        return paligemma2;
        
    } catch (error) {
        console.error('❌ Error downloading PaliGemma2 model:', error);
        throw error;
    }
}

export async function setupLocalVLM() {
    try {
        await ensureModelDir();
        const paligemma2 = await downloadModel();
        console.log('✅ PaliGemma2 VLM setup completed successfully!');
        return paligemma2;
    } catch (error) {
        console.error('❌ Error during PaliGemma2 VLM setup:', error);
        throw error;
    }
}

// Run setup if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    console.log('🚀 Setting up PaliGemma2 VLM model locally...');
    setupLocalVLM()
        .then(() => {
            console.log('✅ Setup complete!');
        })
        .catch((error) => {
            console.error('❌ Setup failed:', error);
            process.exit(1);
        });
}
