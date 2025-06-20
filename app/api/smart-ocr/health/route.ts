import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import VLMModelManager from '../../../../lib/vlm-model-manager.js';
import logger from '../../../../lib/logger';

const vlmManager = new VLMModelManager({
    modelId: 'NSTiwari/paligemma2-3b-mix-224-onnx',
    useLocalFiles: true,
    modelPaths: [
        path.join(process.cwd(), 'models', 'paligemma2', 'google')
    ],
    timeout: 30000
});

export async function GET(request) {
    try {
        // Check if VLM model is available
        let vlmStatus = 'unknown';
        try {
            await vlmManager.loadModel('paligemma2');
            vlmStatus = 'available';
        } catch (error) {
            vlmStatus = 'unavailable';
            logger.warn(`VLM status check failed: ${error.message}`);
        }

        // Check Tesseract installation
        let tesseractStatus = 'unknown';
        try {
            // Use synchronous execSync to check Tesseract version
            const { execSync } = await import('child_process');
            const version = execSync('tesseract --version').toString().trim().split('\n')[0];
            tesseractStatus = version || 'installed';
        } catch (error) {
            tesseractStatus = 'unavailable';
            logger.warn(`Tesseract status check failed: ${error.message}`);
        }

        // Check OCRmyPDF installation
        let ocrmypdfStatus = 'unknown';
        try {
            const { execSync } = await import('child_process');
            const version = execSync('ocrmypdf --version').toString().trim();
            ocrmypdfStatus = version || 'installed';
        } catch (error) {
            ocrmypdfStatus = 'unavailable';
            logger.warn(`OCRmyPDF status check failed: ${error.message}`);
        }

        // Check for uploads directory
        const uploadsDir = path.join(process.cwd(), 'uploads');
        let uploadsStatus = 'unknown';
        try {
            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
            }
            uploadsStatus = fs.existsSync(uploadsDir) ? 'available' : 'unavailable';
        } catch (error) {
            uploadsStatus = 'error';
            logger.warn(`Uploads directory check failed: ${error.message}`);
        }

        // Return health status
        return NextResponse.json({
            status: "OK",
            timestamp: new Date().toISOString(),
            components: {
                vlm: vlmStatus,
                tesseract: tesseractStatus,
                ocrmypdf: ocrmypdfStatus,
                storage: uploadsStatus
            }
        });
    } catch (error) {
        logger.error(`Health check error: ${error.message}`);
        return NextResponse.json({
            status: "ERROR",
            error: error.message,
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}
