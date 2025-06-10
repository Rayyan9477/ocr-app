"""
NanoVLM OCR Specialized Service
Optimized for high-accuracy text recognition
"""
import os
import logging
import tempfile
import traceback
from typing import Optional, Dict, Any, List
import cv2
import numpy as np
from PIL import Image
from fastapi import FastAPI, File, UploadFile, HTTPException, Form, BackgroundTasks
from fastapi.responses import JSONResponse
import uvicorn
from pathlib import Path
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

class OCRProcessingError(Exception):
    """Custom exception for OCR processing errors"""
    def __init__(self, message: str, status_code: int = 500, details: Optional[Dict] = None):
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)

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

def cleanup_temp_files(files: List[str]) -> None:
    """Clean up temporary files"""
    for file_path in files:
        try:
            if file_path and os.path.exists(file_path):
                os.unlink(file_path)
        except Exception as e:
            logger.warning(f"Failed to clean up temporary file {file_path}: {e}")

@app.on_event("startup")
async def startup_event():
    """Initialize model on startup"""
    initialize_nanovlm_model()

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "service": "NanoVLM OCR"
    }

# Core OCR processing route
@app.post("/ocr/process-page")
async def process_page(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    page_number: int = Form(...),
    enhancement_mode: str = Form(default="standard"),
    language: str = Form(default="en")
):
    """Process a single page with NanoVLM OCR"""
    temp_files = []

    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
        
    if page_number < 1:
        raise HTTPException(status_code=400, detail="Invalid page number")
        
    try:
        # Create temporary file
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
        temp_files.append(temp_file.name)
        
        # Save uploaded content
        content = await file.read()
        temp_file.write(content)
        temp_file.close()
        
        # Validate image
        try:
            with Image.open(temp_file.name) as img:
                logger.info(f"Processing image: {img.size}")
        except Exception as e:
            raise OCRProcessingError("Invalid image file", status_code=400, details={"error": str(e)})
            
        # Process image
        try:
            processed_path = preprocess_image(temp_file.name, enhancement_mode)
            temp_files.append(processed_path)
            
            result = process_with_nanovlm(processed_path)
            
            if not isinstance(result, dict) or 'text' not in result:
                raise OCRProcessingError("Invalid processor result")
                
            response = {
                "success": True,
                "results": [{
                    "text": result.get("text", ""),
                    "confidence": result.get("confidence", 0.0),
                    "page": page_number
                }],
                "engine": "NanoVLM",
                "enhancement_mode": enhancement_mode,
                "language": language,
                "metadata": {
                    "filename": file.filename,
                    "file_size": len(content),
                    "mime_type": file.content_type
                }
            }
            
            background_tasks.add_task(cleanup_temp_files, temp_files)
            return JSONResponse(response)
            
        except Exception as e:
            raise OCRProcessingError(
                "Processing failed",
                details={"error": str(e), "page": page_number}
            )
            
    except OCRProcessingError as e:
        logger.error(f"OCR error: {e.message}")
        raise HTTPException(
            status_code=e.status_code,
            detail={"error": e.message, "details": e.details}
        )
        
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        logger.debug(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail={"error": "Internal server error", "message": str(e)}
        )
        
    finally:
        cleanup_temp_files(temp_files)

@app.get("/ocr/capabilities")
async def get_capabilities():
    """Get OCR engine capabilities"""
    return {
        "engine": "NanoVLM",
        "version": "nanoVLM-222M",
        "supported_formats": ["png", "jpg", "jpeg", "tiff", "bmp"],
        "features": [
            "high_accuracy_text_recognition",
            "handwriting_recognition",
            "table_recognition",
            "poor_quality_enhancement"
        ],
        "enhancement_modes": ["standard", "aggressive"]
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8003)
