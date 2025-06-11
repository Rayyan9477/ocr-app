"""
NanoVLM OCR Specialized Service
Optimized for high-accuracy text recognition
"""
import os
import logging
import sys
from typing import Optional, Dict, Any, List
import tempfile
import traceback
from pathlib import Path
import torch
from PIL import Image
import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException, Form, BackgroundTasks
from fastapi.responses import JSONResponse
import uvicorn

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="NanoVLM OCR Service",
    description="Advanced OCR service using nanoVLM-222M model",
    version="1.0.0"
)

# Global model instances
model = None
processor = None
tokenizer = None

def initialize_nanovlm_model():
    """Initialize NanoVLM model and processors"""
    global model, processor, tokenizer
    try:
        logger.info("Initializing NanoVLM model...")
        
        # Load model and processors
        model_path = os.getenv("MODEL_PATH", "models/nanovlm-222m")
        if not os.path.exists(model_path):
            raise Exception(f"Model path not found: {model_path}")

        from transformers import VisionEncoderDecoderModel, ViTImageProcessor, AutoTokenizer
        
        # Load model components
        model = VisionEncoderDecoderModel.from_pretrained(model_path)
        processor = ViTImageProcessor.from_pretrained(model_path)
        tokenizer = AutoTokenizer.from_pretrained(model_path)
        
        # Set up device and optimize for CPU if GPU not available
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        if device.type == "cpu":
            logger.info("Running on CPU - applying optimizations")
            torch.set_num_threads(4)  # Adjust based on available CPU cores
            model = model.float()  # Use float32 for better CPU performance
            
        model.to(device)
        model.eval()  # Set to evaluation mode
        torch.set_grad_enabled(False)  # Disable gradient computation
        
        logger.info(f"NanoVLM model initialized successfully on {device}")
    except Exception as e:
        logger.error(f"Failed to initialize NanoVLM model: {e}")
        logger.error(traceback.format_exc())
        raise

@app.on_event("startup")
async def startup_event():
    """Initialize the model on startup"""
    try:
        initialize_nanovlm_model()
    except Exception as e:
        logger.error(f"Startup failed: {e}")
        sys.exit(1)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    if model is None or processor is None or tokenizer is None:
        raise HTTPException(status_code=503, detail="Model not initialized")
    return {"status": "healthy", "model": "nanovlm-222m"}

@app.post("/ocr/process-page")
async def process_page(
    file: UploadFile = File(...),
    enhance_resolution: bool = Form(False)
) -> Dict[str, Any]:
    """Process a single page with NanoVLM OCR"""
    try:
        # Create temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp.flush()
            
            # Process with NanoVLM
            from python.processors.nanovlm_processor import process_image
            result = process_image(os.getenv("MODEL_PATH", "models/nanovlm-222m"), tmp.name)
            
            # Clean up
            os.unlink(tmp.name)
            
            if "error" in result:
                raise HTTPException(status_code=500, detail=result["error"])
            
            return result
    except Exception as e:
        logger.error(f"Error processing page: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/ocr/capabilities")
async def get_capabilities() -> Dict[str, Any]:
    """Get model capabilities"""
    return {
        "model": "nanovlm-222m",
        "device": "cuda" if torch.cuda.is_available() else "cpu",
        "supported_formats": ["jpg", "jpeg", "png", "tiff"],
        "batch_support": True,
        "max_resolution": None,  # No strict limit
        "languages": ["en"],  # Base model supports English
        "features": {
            "enhance_resolution": True,
            "preserve_layout": True,
            "confidence_scores": True
        }
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8003)
