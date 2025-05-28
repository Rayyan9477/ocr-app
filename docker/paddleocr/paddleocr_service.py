"""
PaddleOCR Specialized OCR Service for Low-Confidence Page Reprocessing
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
from paddleocr import PaddleOCR

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="PaddleOCR Specialized OCR Service",
    description="Advanced OCR service for reprocessing low-confidence pages",
    version="1.0.0"
)

# Global OCR engine instance
ocr_engine: Optional[PaddleOCR] = None

def initialize_ocr_engine():
    """Initialize PaddleOCR engine with optimized settings for handwritten and medical documents"""
    global ocr_engine
    try:
        logger.info("Initializing PaddleOCR engine...")
        ocr_engine = PaddleOCR(
            use_angle_cls=True,
            lang='en',
            use_gpu=False,  # Set to True if GPU is available
            show_log=False,
            # Optimized settings for handwritten and medical documents
            det_db_thresh=0.2,  # Lower threshold for better detection of faint text
            det_db_box_thresh=0.4,  # More sensitive box threshold for handwriting
            det_db_unclip_ratio=2.5,  # Increase unclip ratio for better text boundaries
            rec_batch_num=4,  # Smaller batch size for better quality
            rec_image_shape="3, 48, 320",  # Optimized image shape for recognition
            max_text_length=50,  # Allow longer text sequences for medical terms
        )
        logger.info("PaddleOCR engine initialized successfully with handwriting optimization")
    except Exception as e:
        logger.error(f"Failed to initialize PaddleOCR engine: {e}")
        raise

@app.on_event("startup")
async def startup_event():
    """Initialize OCR engine on startup"""
    initialize_ocr_engine()

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    if ocr_engine is None:
        raise HTTPException(status_code=503, detail="OCR engine not initialized")
    return {"status": "healthy", "service": "PaddleOCR"}

@app.post("/ocr/process-page")
async def process_page(
    file: UploadFile = File(...),
    page_number: int = Form(...),
    enhancement_mode: str = Form(default="standard"),
    language: str = Form(default="en")
):
    """
    Process a single page with PaddleOCR for better results than Tesseract
    
    Args:
        file: Image file (PNG, JPG) or PDF page
        page_number: Page number being processed
        enhancement_mode: Processing mode (standard, enhanced, medical)
        language: OCR language (en, ch, etc.)
    """
    if ocr_engine is None:
        raise HTTPException(status_code=503, detail="OCR engine not initialized")
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    try:
        # Read file content
        content = await file.read()
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as temp_file:
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        try:
            # Process image with PaddleOCR
            logger.info(f"Processing page {page_number} with enhancement mode: {enhancement_mode}")
            
            # Apply image preprocessing based on enhancement mode
            processed_image_path = preprocess_image(temp_file_path, enhancement_mode)
            
            # Run OCR
            results = ocr_engine.ocr(processed_image_path, cls=True)
            
            # Parse results and extract confidence scores
            parsed_results = parse_paddleocr_results(results, page_number)
            
            # Clean up temporary files
            os.unlink(temp_file_path)
            if processed_image_path != temp_file_path:
                os.unlink(processed_image_path)
            
            return JSONResponse({
                "success": True,
                "page_number": page_number,
                "enhancement_mode": enhancement_mode,
                "language": language,
                "results": parsed_results,
                "engine": "PaddleOCR",
                "confidence_stats": calculate_confidence_stats(parsed_results)
            })
            
        except Exception as processing_error:
            # Clean up on error
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
            raise processing_error
            
    except Exception as e:
        logger.error(f"Error processing page {page_number}: {e}")
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

def preprocess_image(image_path: str, enhancement_mode: str) -> str:
    """
    Apply image preprocessing based on enhancement mode
    
    Args:
        image_path: Path to input image
        enhancement_mode: Processing mode (standard, enhanced, medical, handwritten, aggressive)
    
    Returns:
        Path to processed image
    """
    try:
        # Read image
        image = cv2.imread(image_path)
        if image is None:
            # Try with PIL for better format support
            pil_image = Image.open(image_path)
            image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
        
        if enhancement_mode == "enhanced":
            # Enhanced processing: noise reduction, contrast enhancement
            image = cv2.fastNlMeansDenoisingColored(image, None, 10, 10, 7, 21)
            lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
            l = clahe.apply(l)
            image = cv2.merge([l, a, b])
            image = cv2.cvtColor(image, cv2.COLOR_LAB2BGR)
            
        elif enhancement_mode == "medical":
            # Medical document specific processing
            # Convert to grayscale
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # Apply adaptive thresholding for better text extraction
            adaptive_thresh = cv2.adaptiveThreshold(
                gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
            )
            
            # Morphological operations to improve text clarity
            kernel = np.ones((2,2), np.uint8)
            image = cv2.morphologyEx(adaptive_thresh, cv2.MORPH_CLOSE, kernel)
            
            # Convert back to BGR for PaddleOCR
            image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
            
        elif enhancement_mode == "handwritten":
            # Specialized processing for handwritten text
            image = enhance_handwritten_text(image)
            
        elif enhancement_mode == "aggressive":
            # Most aggressive enhancement for very poor quality text
            image = aggressive_enhancement(image)
        
        # Save processed image
        with tempfile.NamedTemporaryFile(delete=False, suffix='.png') as temp_file:
            processed_path = temp_file.name
            cv2.imwrite(processed_path, image)
            return processed_path
            
    except Exception as e:
        logger.warning(f"Image preprocessing failed, using original: {e}")
        return image_path

def parse_paddleocr_results(results: List, page_number: int) -> Dict[str, Any]:
    """
    Parse PaddleOCR results and extract structured data
    
    Args:
        results: Raw PaddleOCR results
        page_number: Page number
    
    Returns:
        Structured results with confidence scores
    """
    parsed_data = {
        "page_number": page_number,
        "text_blocks": [],
        "full_text": "",
        "word_count": 0,
        "avg_confidence": 0.0
    }
    
    if not results or not results[0]:
        return parsed_data
    
    total_confidence = 0.0
    word_count = 0
    full_text_parts = []
    
    for line in results[0]:
        if len(line) >= 2:
            bbox = line[0]  # Bounding box coordinates
            text_info = line[1]  # (text, confidence)
            
            if len(text_info) >= 2:
                text = text_info[0]
                confidence = float(text_info[1])
                
                text_block = {
                    "text": text,
                    "confidence": confidence,
                    "bbox": {
                        "x1": int(bbox[0][0]),
                        "y1": int(bbox[0][1]),
                        "x2": int(bbox[2][0]),
                        "y2": int(bbox[2][1])
                    }
                }
                
                parsed_data["text_blocks"].append(text_block)
                full_text_parts.append(text)
                total_confidence += confidence
                word_count += len(text.split())
    
    parsed_data["full_text"] = " ".join(full_text_parts)
    parsed_data["word_count"] = word_count
    parsed_data["avg_confidence"] = total_confidence / len(parsed_data["text_blocks"]) if parsed_data["text_blocks"] else 0.0
    
    return parsed_data

def calculate_confidence_stats(results: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate confidence statistics for the processed page"""
    text_blocks = results.get("text_blocks", [])
    
    if not text_blocks:
        return {
            "total_blocks": 0,
            "avg_confidence": 0.0,
            "min_confidence": 0.0,
            "max_confidence": 0.0,
            "low_confidence_blocks": 0,
            "confidence_distribution": {}
        }
    
    confidences = [block["confidence"] for block in text_blocks]
    low_confidence_threshold = 0.7  # 70% threshold
    
    stats = {
        "total_blocks": len(text_blocks),
        "avg_confidence": sum(confidences) / len(confidences),
        "min_confidence": min(confidences),
        "max_confidence": max(confidences),
        "low_confidence_blocks": sum(1 for c in confidences if c < low_confidence_threshold),
        "confidence_distribution": {
            "excellent": sum(1 for c in confidences if c >= 0.95),
            "good": sum(1 for c in confidences if 0.85 <= c < 0.95),
            "fair": sum(1 for c in confidences if 0.70 <= c < 0.85),
            "poor": sum(1 for c in confidences if c < 0.70)
        }
    }
    
    return stats

@app.post("/ocr/batch-process")
async def batch_process_pages(
    files: List[UploadFile] = File(...),
    enhancement_mode: str = Form(default="standard")
):
    """
    Process multiple pages in batch for better efficiency
    """
    if ocr_engine is None:
        raise HTTPException(status_code=503, detail="OCR engine not initialized")
    
    results = []
    
    for i, file in enumerate(files):
        try:
            # Process each file
            result = await process_page(file, i + 1, enhancement_mode)
            results.append(result)
        except Exception as e:
            logger.error(f"Failed to process file {file.filename}: {e}")
            results.append({
                "success": False,
                "page_number": i + 1,
                "error": str(e),
                "filename": file.filename
            })
    
    return JSONResponse({
        "success": True,
        "total_pages": len(files),
        "results": results,
        "engine": "PaddleOCR"
    })

@app.get("/ocr/capabilities")
async def get_capabilities():
    """Get OCR engine capabilities and supported features"""
    return {
        "engine": "PaddleOCR",
        "version": "2.7.3",
        "supported_languages": ["en", "ch", "french", "german", "korean", "japan"],
        "enhancement_modes": ["standard", "enhanced", "medical", "handwritten", "aggressive"],
        "features": [
            "high_accuracy_text_detection",
            "confidence_scoring",
            "angle_classification",
            "table_recognition",
            "layout_analysis"
        ],
        "optimal_for": [
            "medical_documents",
            "low_quality_scans",
            "handwritten_text",
            "structured_documents"
        ]
    }

def enhance_handwritten_text(image: np.ndarray) -> np.ndarray:
    """
    Apply specialized enhancement for handwritten text recognition
    
    Args:
        image: Input image as numpy array
        
    Returns:
        Enhanced image optimized for handwritten text
    """
    try:
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Apply Gaussian blur to reduce noise while preserving text
        blurred = cv2.GaussianBlur(gray, (3, 3), 0)
        
        # Enhance contrast using CLAHE (Contrast Limited Adaptive Histogram Equalization)
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(blurred)
        
        # Apply adaptive thresholding specifically tuned for handwriting
        # Use a larger block size for handwritten text
        adaptive_thresh = cv2.adaptiveThreshold(
            enhanced, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 15, 8
        )
        
        # Morphological operations to connect broken letters
        # Use elliptical kernel to better match handwriting strokes
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2, 2))
        closed = cv2.morphologyEx(adaptive_thresh, cv2.MORPH_CLOSE, kernel)
        
        # Light dilation to thicken thin handwritten strokes
        dilated = cv2.dilate(closed, kernel, iterations=1)
        
        # Convert back to BGR for PaddleOCR
        result = cv2.cvtColor(dilated, cv2.COLOR_GRAY2BGR)
        
        logger.info("Applied handwritten text enhancement")
        return result
        
    except Exception as e:
        logger.warning(f"Handwritten enhancement failed: {e}")
        return image

def aggressive_enhancement(image: np.ndarray) -> np.ndarray:
    """
    Apply the most aggressive enhancement for very poor quality text
    
    Args:
        image: Input image as numpy array
        
    Returns:
        Aggressively enhanced image
    """
    try:
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Aggressive noise reduction
        denoised = cv2.fastNlMeansDenoising(gray, None, 20, 7, 21)
        
        # Strong contrast enhancement
        clahe = cv2.createCLAHE(clipLimit=4.0, tileGridSize=(4, 4))
        contrast_enhanced = clahe.apply(denoised)
        
        # Histogram equalization for global contrast
        equalized = cv2.equalizeHist(contrast_enhanced)
        
        # Multiple adaptive thresholding approaches and combine
        # Method 1: Gaussian adaptive
        thresh1 = cv2.adaptiveThreshold(
            equalized, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
        )
        
        # Method 2: Mean adaptive with different parameters
        thresh2 = cv2.adaptiveThreshold(
            equalized, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 15, 8
        )
        
        # Combine thresholding results
        combined = cv2.bitwise_and(thresh1, thresh2)
        
        # Aggressive morphological operations
        # Close gaps in text
        kernel_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        closed = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel_close, iterations=2)
        
        # Remove small noise
        kernel_open = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        opened = cv2.morphologyEx(closed, cv2.MORPH_OPEN, kernel_open)
        
        # Final dilation to thicken text
        kernel_dilate = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2, 2))
        final = cv2.dilate(opened, kernel_dilate, iterations=1)
        
        # Convert back to BGR
        result = cv2.cvtColor(final, cv2.COLOR_GRAY2BGR)
        
        logger.info("Applied aggressive enhancement")
        return result
        
    except Exception as e:
        logger.warning(f"Aggressive enhancement failed: {e}")
        return image
