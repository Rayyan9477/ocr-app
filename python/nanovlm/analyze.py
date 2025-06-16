"""
Document analysis module for NanoVLM
"""
import os
import logging
from typing import Union, Any

# Try to import optional dependencies with fallbacks
try:
    import cv2
    import numpy as np
    HAS_CV2 = True
except ImportError as e:
    logging.warning(f"OpenCV not available: {e}")
    HAS_CV2 = False
    cv2 = None
    np = None

try:
    from PIL import Image
    HAS_PIL = True
except ImportError as e:
    logging.warning(f"PIL not available: {e}")
    HAS_PIL = False

logger = logging.getLogger(__name__)

def analyze_document(image_path: str) -> dict:
    """
    Analyze a document to determine its characteristics
    """
    if not HAS_CV2:
        # Return basic analysis without OpenCV
        return {
            "hasHandwriting": False,
            "hasTables": False,
            "poorQuality": False,
            "complexLayout": False,
            "confidence": {
                "handwriting": 0.5,
                "tables": 0.5,
                "quality": 0.8,
                "layout": 0.8
            },
            "documentType": "general",
            "averageConfidence": 0.65,
            "error": "OpenCV not available for detailed analysis"
        }
    
    try:
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image file not found: {image_path}")

        # Read the image
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError("Failed to load image")

        # Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # Analyze for handwriting
        has_handwriting = detect_handwriting(gray)

        # Analyze for tables
        has_tables = detect_tables(gray)

        # Check image quality
        poor_quality = check_poor_quality(gray)

        # Analyze layout complexity
        complex_layout = analyze_layout_complexity(gray)

        # Calculate confidence scores
        confidence = {
            "handwriting": 0.8 if has_handwriting else 0.2,
            "tables": 0.8 if has_tables else 0.2,
            "quality": 0.2 if poor_quality else 0.8,
            "layout": 0.3 if complex_layout else 0.8
        }

        return {
            "hasHandwriting": has_handwriting,
            "hasTables": has_tables,
            "poorQuality": poor_quality,
            "complexLayout": complex_layout,
            "confidence": confidence
        }

    except Exception as e:
        logger.error(f"Error analyzing document: {e}")
        return {
            "hasHandwriting": False,
            "hasTables": False,
            "poorQuality": False,
            "complexLayout": False,
            "confidence": {
                "handwriting": 0,
                "tables": 0,
                "quality": 0,
                "layout": 0
            }
        }

from typing import Union, Any

def detect_handwriting(gray_img: Union[Any, None]) -> bool:
    """Detect presence of handwriting in an image"""
    if not HAS_CV2 or gray_img is None:
        return False
    
    try:
        edges = cv2.Canny(gray_img, 50, 150)
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        irregular_shapes = 0
        for contour in contours:
            if len(contour) > 10:
                perimeter = cv2.arcLength(contour, True)
                approx = cv2.approxPolyDP(contour, 0.02 * perimeter, True)
                if len(approx) > 6:  # Complex shapes more likely in handwriting
                    irregular_shapes += 1
        
        return irregular_shapes > len(contours) * 0.3
    except:
        return False

def detect_tables(gray_img: Union[Any, None]) -> bool:
    """Detect presence of tables in an image"""
    if not HAS_CV2 or gray_img is None:
        return False
    try:
        edges = cv2.Canny(gray_img, 50, 150)
        lines = cv2.HoughLinesP(edges, 1, np.pi/180, 100, minLineLength=100, maxLineGap=10)
        
        if lines is None:
            return False
            
        horizontal_lines = 0
        vertical_lines = 0
        
        for line in lines:
            x1, y1, x2, y2 = line[0]
            if abs(y2 - y1) < 10:  # Horizontal line
                horizontal_lines += 1
            if abs(x2 - x1) < 10:  # Vertical line
                vertical_lines += 1
        
        return horizontal_lines > 3 and vertical_lines > 3
    except:
        return False

def check_poor_quality(gray_img: Union[Any, None]) -> bool:
    """Check if image is of poor quality"""
    if not HAS_CV2 or gray_img is None:
        return False
    
    try:
        blur = cv2.Laplacian(gray_img, cv2.CV_64F).var()
        brightness = np.mean(gray_img)
        contrast = np.std(gray_img)
        
        return (blur < 100 or  # Blurry
                brightness < 50 or brightness > 200 or  # Too dark/bright
                contrast < 30)  # Low contrast
    except:
        return False

def analyze_layout_complexity(gray_img: Union[Any, None]) -> bool:
    """Analyze layout complexity of the document"""
    if not HAS_CV2 or gray_img is None:
        return False
    
    try:
        edges = cv2.Canny(gray_img, 50, 150)
        contours, _ = cv2.findContours(edges, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
        
        # Count regions and analyze hierarchy
        if len(contours) > 50:  # Many regions
            return True
            
        return False
    except:
        return False
