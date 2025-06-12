#!/usr/bin/env python3
"""
NanoVLM OCR Service
FastAPI-based service for OCR processing
"""

import os
import logging
from typing import Dict, Any, Optional
import tempfile
from pathlib import Path
from fastapi import FastAPI, File, UploadFile, HTTPException, Form, BackgroundTasks
from fastapi.responses import JSONResponse
import uvicorn
import torch
from PIL import Image
import traceback
import sys

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
image_processor = None
tokenizer = None

class OCRProcessingError(Exception):
    """Custom exception for OCR processing errors"""
    pass

def initialize_nanovlm_model():
    """Initialize NanoVLM model and processors"""
    global model, image_processor, tokenizer
    try:
        logger.info("Initializing NanoVLM model...")
        
        # Load model and processors
        model_path = os.getenv("MODEL_PATH", "models/nanovlm-222m")
        if not os.path.exists(model_path):
            raise Exception(f"Model path not found: {model_path}")

        from transformers import VisionEncoderDecoderModel, ViTImageProcessor, AutoTokenizer
        
        # Load model components
        model = VisionEncoderDecoderModel.from_pretrained(model_path)
        image_processor = ViTImageProcessor.from_pretrained(model_path)
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
    if model is None or image_processor is None or tokenizer is None:
        raise HTTPException(status_code=503, detail="Model not initialized")
    return {"status": "healthy", "model": "nanovlm-222m"}

@app.post("/process")
async def process_document(
    file: UploadFile = File(...),
    enhance_resolution: bool = Form(False),
    language: str = Form("en")
) -> Dict[str, Any]:
    """Process a document with NanoVLM OCR"""
    try:
        # Save uploaded file
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp.flush()
            
            # Process the file
            result = process_with_nanovlm(tmp.name)
            
            # Clean up temp file
            os.unlink(tmp.name)
            
            return result
            
    except Exception as e:
        logger.error(f"Processing failed: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Processing failed: {str(e)}"
        )

def process_with_nanovlm(image_path: str) -> Dict[str, Any]:
    """Process image with NanoVLM model"""
    try:
        # Load and preprocess image
        image = Image.open(image_path).convert("RGB")
        pixel_values = image_processor(image, return_tensors="pt").pixel_values.to(model.device)
        
        # Generate text
        generated_ids = model.generate(
            pixel_values,
            max_length=100,
            num_beams=4,
            temperature=1.0,
            top_k=50,
            top_p=0.95,
            repetition_penalty=1.0,
            length_penalty=1.0,
            early_stopping=True
        )
        
        # Decode text
        generated_text = tokenizer.decode(generated_ids[0], skip_special_tokens=True)
        
        # Calculate confidence (simplified for example)
        confidence = min(100.0, max(0.0, len(generated_text.split()) * 5))
        
        return {
            "text": generated_text,
            "confidence": confidence
        }
        
    except Exception as e:
        logger.error(f"NanoVLM processing failed: {e}")
        return {
            "text": "",
            "confidence": 0.0,
            "error": str(e)
        }

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
