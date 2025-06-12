#!/usr/bin/env python3
"""
Fallback OCR Engine for nanoVLM
Provides alternative OCR methods when the primary method fails
"""

import os
import cv2
import numpy as np
from PIL import Image
import pytesseract
from typing import Dict, Any, Optional, Tuple
import logging
import time
import json
import traceback

logger = logging.getLogger('nanovlm')

class FallbackOCR:
    """Fallback OCR implementation using Tesseract and other simple techniques"""
    
    def __init__(self, config=None):
        """Initialize fallback OCR with optional configuration"""
        self.config = config or {}
        self.tesseract_path = self.config.get('tesseract_path')
        
        # Configure Tesseract path if provided
        if self.tesseract_path and os.path.exists(self.tesseract_path):
            pytesseract.pytesseract.tesseract_cmd = self.tesseract_path
    
    def process(self, image_path: str, document_type: str = 'general', **kwargs) -> Dict[str, Any]:
        """Process document with fallback OCR engine"""
        start_time = time.time()
        logger.info(f"Using fallback OCR engine for {image_path}")
        
        try:
            # Load image
            img = Image.open(image_path)
            
            # Prepare processing options based on document type
            if document_type == 'handwritten':
                ocr_result, confidence = self._process_handwritten(img)
            elif document_type == 'table':
                ocr_result, confidence = self._process_table(img)
            elif document_type == 'poor_quality':
                ocr_result, confidence = self._process_poor_quality(img)
            else:
                ocr_result, confidence = self._process_general(img)
            
            processing_time = time.time() - start_time
            
            # Create result
            result = {
                'success': True,
                'text': ocr_result,
                'confidence': confidence,
                'processing_time': round(processing_time * 1000),  # ms
                'engine': 'fallback_ocr',
                'document_type': document_type,
                'fallback_method': self._get_fallback_method(document_type)
            }
            
            return result
        
        except Exception as e:
            logger.error(f"Fallback OCR failed: {str(e)}")
            logger.debug(f"Traceback: {traceback.format_exc()}")
            
            return {
                'success': False,
                'error': str(e),
                'engine': 'fallback_ocr',
                'processing_time': round((time.time() - start_time) * 1000)
            }
    
    def _get_fallback_method(self, document_type: str) -> str:
        """Return the fallback method used based on document type"""
        methods = {
            'handwritten': 'tesseract_handwritten',
            'table': 'tesseract_table',
            'poor_quality': 'tesseract_with_preprocessing',
            'general': 'tesseract_standard'
        }
        return methods.get(document_type, 'tesseract_standard')
    
    def _process_general(self, img: Image.Image) -> Tuple[str, float]:
        """Process general document with Tesseract"""
        # Convert PIL Image to numpy array for OpenCV
        img_np = np.array(img)
        
        # Convert to grayscale if needed
        if len(img_np.shape) == 3:
            gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
        else:
            gray = img_np
            
        # Apply threshold to get a binary image
        _, binary = cv2.threshold(gray, 128, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
        
        # Use Tesseract for OCR
        result = pytesseract.image_to_string(binary)
        
        # Calculate confidence (simplified)
        confidence = 0.6  # Default conservative confidence score
        
        return result, confidence
    
    def _process_handwritten(self, img: Image.Image) -> Tuple[str, float]:
        """Process handwritten document with enhanced settings"""
        # Convert PIL Image to numpy array for OpenCV
        img_np = np.array(img)
        
        # Convert to grayscale if needed
        if len(img_np.shape) == 3:
            gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
        else:
            gray = img_np
            
        # Apply adaptive threshold to get a binary image
        binary = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2)
        
        # Use Tesseract with settings optimized for handwritten text
        custom_config = r'--oem 1 --psm 6'
        result = pytesseract.image_to_string(binary, config=custom_config)
        
        # Calculate confidence (simplified)
        confidence = 0.4  # Lower confidence for handwritten
        
        return result, confidence
    
    def _process_table(self, img: Image.Image) -> Tuple[str, float]:
        """Process document with tables"""
        # Convert PIL Image to numpy array for OpenCV
        img_np = np.array(img)
        
        # Convert to grayscale if needed
        if len(img_np.shape) == 3:
            gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
        else:
            gray = img_np
            
        # Apply threshold to get a binary image
        _, binary = cv2.threshold(gray, 128, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
        
        # Use Tesseract with table extraction config
        custom_config = r'--oem 1 --psm 6 -c preserve_interword_spaces=1'
        result = pytesseract.image_to_string(binary, config=custom_config)
        
        # Calculate confidence (simplified)
        confidence = 0.5  # Medium confidence for tables
        
        return result, confidence
    
    def _process_poor_quality(self, img: Image.Image) -> Tuple[str, float]:
        """Process poor quality document with enhancement"""
        # Convert PIL Image to numpy array for OpenCV
        img_np = np.array(img)
        
        # Convert to grayscale if needed
        if len(img_np.shape) == 3:
            gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
        else:
            gray = img_np
            
        # Apply preprocessing to enhance poor quality document
        # Denoise
        denoised = cv2.fastNlMeansDenoising(gray, None, 10, 7, 21)
        
        # Contrast enhancement
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(denoised)
        
        # Adaptive threshold
        binary = cv2.adaptiveThreshold(enhanced, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2)
        
        # Use Tesseract with specific config
        custom_config = r'--oem 1 --psm 6'
        result = pytesseract.image_to_string(binary, config=custom_config)
        
        # Calculate confidence (simplified)
        confidence = 0.45  # Lower confidence for poor quality
        
        return result, confidence
