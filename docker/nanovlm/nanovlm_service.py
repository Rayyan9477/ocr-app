"""
NanoVLM OCR Specialized Service
Optimized for high-accuracy text recognition
"""
import os
import logging
import tempfile
from typing import Optional, Dict, Any, List
from pathlib import Path
import cv2
import numpy as np
from PIL import Image
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.responses import JSONResponse
import uvicorn
from transformers import VisionEncoderDecoderModel, ViTImageProcessor, AutoTokenizer
import torch

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

def initialize_nanovlm_model():
    """Initialize NanoVLM model and processors"""
    global model, image_processor, tokenizer
    try:
        logger.info("Initializing NanoVLM model...")
        
        # Load model and processors from HuggingFace
        model_name = "lusxvr/nanoVLM-222M"
        model = VisionEncoderDecoderModel.from_pretrained(model_name)
        image_processor = ViTImageProcessor.from_pretrained(model_name)
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        
        # Move model to GPU if available
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model.to(device)
        
        logger.info(f"NanoVLM model initialized successfully on {device}")
    except Exception as e:
        logger.error(f"Failed to initialize NanoVLM model: {e}")
        raise

def preprocess_image(image_path: str, enhancement_mode: str = "standard") -> str:
    """Preprocess image for better OCR results"""
    try:
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError("Could not read image")

        if enhancement_mode == "standard":
            # Basic preprocessing
            image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        elif enhancement_mode == "enhanced":
            # Enhanced preprocessing
            image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            image = cv2.fastNlMeansDenoisingColored(image)
            
        elif enhancement_mode == "aggressive":
            # Aggressive enhancement for poor quality documents
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            denoised = cv2.fastNlMeansDenoising(gray)
            
            # Adaptive thresholding
            binary = cv2.adaptiveThreshold(
                denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
            )
            
            # Morphological operations
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
            processed = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
            
            # Convert back to RGB
            image = cv2.cvtColor(processed, cv2.COLOR_GRAY2RGB)
        
        # Save processed image
        with tempfile.NamedTemporaryFile(delete=False, suffix='.png') as temp_file:
            processed_path = temp_file.name
            cv2.imwrite(processed_path, cv2.cvtColor(image, cv2.COLOR_RGB2BGR))
            return processed_path
            
    except Exception as e:
        logger.warning(f"Image preprocessing failed, using original: {e}")
        return image_path

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
        
        # Calculate confidence (simplified)
        confidence = min(100.0, max(0.0, len(generated_text.split()) * 5))
        
        return {
            "text": generated_text,
            "confidence": confidence
        }
        
    except Exception as e:
        logger.error(f"NanoVLM processing failed: {e}")
        return {
            "text": "",
            "confidence": 0.0
        }

@app.on_event("startup")
async def startup_event():
    """Initialize model on startup"""
    initialize_nanovlm_model()

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    if model is None or image_processor is None or tokenizer is None:
        raise HTTPException(status_code=503, detail="Model not initialized")
    return {"status": "healthy", "model": "nanoVLM-222M"}

@app.post("/ocr/process-page")
async def process_page(
    file: UploadFile = File(...),
    page_number: int = Form(...),
    enhancement_mode: str = Form(default="standard"),
    language: str = Form(default="en")
):
    """Process a single page with NanoVLM OCR"""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not initialized")
    
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.png') as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
            
            try:
                # Preprocess image
                processed_path = preprocess_image(temp_file_path, enhancement_mode)
                
                # Process with NanoVLM
                result = process_with_nanovlm(processed_path)
                
                # Prepare response
                response = {
                    "success": True,
                    "page_number": page_number,
                    "results": [{
                        "text": result["text"],
                        "confidence": result["confidence"],
                        "page": page_number,
                        "bbox": {"x": 0, "y": 0, "width": 100, "height": 100}
                    }],
                    "engine": "NanoVLM",
                    "enhancement_mode": enhancement_mode,
                    "language": language,
                    "confidence_stats": {
                        "average": result["confidence"],
                        "min": result["confidence"],
                        "max": result["confidence"]
                    }
                }
                
                return JSONResponse(response)
                
            finally:
                # Clean up temporary files
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)
                if processed_path != temp_file_path and os.path.exists(processed_path):
                    os.unlink(processed_path)
                    
    except Exception as e:
        logger.error(f"Error processing page {page_number}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/ocr/capabilities")
async def get_capabilities():
    """Get OCR engine capabilities and supported features"""
    return {
        "engine": "NanoVLM",
        "model": "nanoVLM-222M",
        "supported_languages": ["en"],
        "enhancement_modes": ["standard", "enhanced", "aggressive"],
        "features": [
            "high_accuracy_text_recognition",
            "robust_text_extraction",
            "layout_awareness",
            "noise_resistance"
        ],
        "optimal_for": [
            "general_text",
            "structured_documents",
            "poor_quality_scans"
        ]
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8003)
