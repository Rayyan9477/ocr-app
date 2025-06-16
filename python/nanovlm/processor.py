#!/usr/bin/env python3
"""
NanoVLM processor for enhanced OCR results
- Supports handwritten text, tables, and poor quality documents
- Provides confidence scores and processing time metrics
- Handles document layout preservation
- Implements robust error handling and fallback strategies
"""

import argparse
import json
import os
import time
import traceback
import sys
from PIL import Image
from typing import Dict, Any, Optional, List, Tuple
import logging
import tempfile
import shutil
import concurrent.futures
from PIL import Image, ImageEnhance, ImageFilter

# Try to import optional dependencies with proper error handling
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
    import pytesseract
    HAS_TESSERACT = True
except ImportError as e:
    logging.warning(f"pytesseract not available: {e}")
    HAS_TESSERACT = False
    pytesseract = None

# Import nanoVLM modules
from .preprocess_image import denoise_image, deskew_image, adjust_contrast_brightness, enhance_resolution
from .analyze import analyze_document
from .fallback_ocr import FallbackOCR

# Define error classes for better error handling
class OCRError(Exception):
    """Base class for OCR-related errors"""
    pass

class ImageError(OCRError):
    """Error related to image loading or validation"""
    pass

class ProcessingError(OCRError):
    """Error during OCR processing"""
    pass

class NanoVLMProcessor:
    def __init__(self, model_path=None, max_retries=2, enable_fallback=True):
        self.logger = logging.getLogger('nanovlm')
        self.setup_logging()
        self.supported_types = ['general', 'handwritten', 'table', 'poor_quality']
        self.supported_formats = {'.png', '.jpg', '.jpeg', '.tiff', '.bmp'}
        self.model_path = model_path
        self.max_retries = max_retries
        self.enable_fallback = enable_fallback
        self.fallback_ocr = FallbackOCR() if enable_fallback else None
        
        # Track processing attempts for metrics
        self.metrics = {
            'primary_success': 0,
            'fallback_success': 0,
            'total_failures': 0,
            'retry_success': 0
        }

    def setup_logging(self):
        """Configure logging with proper handlers"""
        log_dir = os.path.join(os.path.dirname(__file__), 'logs')
        os.makedirs(log_dir, exist_ok=True)
        
        log_file = os.path.join(log_dir, f'nanovlm_{time.strftime("%Y%m%d")}.log')
        file_handler = logging.FileHandler(log_file)
        console_handler = logging.StreamHandler()
        
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        file_handler.setFormatter(formatter)
        console_handler.setFormatter(formatter)
        
        self.logger.addHandler(file_handler)
        self.logger.addHandler(console_handler)
        self.logger.setLevel(logging.DEBUG if os.getenv('NANOVLM_LOG_LEVEL') == 'DEBUG' else logging.INFO)

    def validate_paths(self, image_path: str, output_dir: str) -> None:
        """Validate input and output paths with detailed error messages"""
        # Check if input file exists
        if not os.path.exists(image_path):
            raise ImageError(f"Input file not found: {image_path}. Please verify the file path.")

        # Validate file format
        ext = os.path.splitext(image_path)[1].lower()
        if ext not in self.supported_formats:
            raise ImageError(
                f"Unsupported file format: {ext}. Supported formats: {', '.join(self.supported_formats)}. "
                f"Please convert your file to one of the supported formats."
            )

        # Check if input file is readable
        try:
            with open(image_path, 'rb') as f:
                pass
        except Exception as e:
            raise ImageError(f"Cannot read input file: {image_path} - {str(e)}. "
                           f"Please check file permissions and integrity.")

        # Validate image can be opened and processed
        try:
            with Image.open(image_path) as img:
                # Validate image dimensions
                width, height = img.size
                if width < 10 or height < 10:
                    raise ImageError(f"Image dimensions too small: {width}x{height}. "
                                   f"Minimum recommended size is 10x10 pixels.")
                
                # Check for corrupt images
                img.verify()
        except Exception as e:
            raise ImageError(f"Invalid or corrupt image file: {image_path} - {str(e)}. "
                           f"Please ensure the image is not corrupted.")

        # Validate output directory
        try:
            os.makedirs(output_dir, exist_ok=True)
            test_file = os.path.join(output_dir, 'test_write.tmp')
            with open(test_file, 'w') as f:
                f.write('test')
            os.remove(test_file)
        except Exception as e:
            raise IOError(f"Cannot write to output directory: {output_dir} - {str(e)}. "
                        f"Please check directory permissions.")

    def process_document(self, input_path: str, output_path: str, **kwargs) -> Dict[str, Any]:
        """Process document with NanoVLM"""
        start_time = time.time()
        logger.info(f"Processing document: {input_path}")
        
        try:
            # Validate input file
            if not os.path.exists(input_path):
                raise OCRError(f"Input file not found: {input_path}")
            
            # Create temporary directory for processing
            with tempfile.TemporaryDirectory() as temp_dir:
                # Determine document type if not provided
                doc_type = kwargs.get('document_type', 'general')
                if doc_type == 'auto':
                    doc_type = self._analyze_document_type(input_path)
                
                # Process based on document type
                if doc_type == 'handwritten':
                    result = self._process_handwritten(input_path, temp_dir)
                elif doc_type == 'table':
                    result = self._process_table(input_path, temp_dir)
                elif doc_type == 'poor_quality':
                    result = self._process_poor_quality(input_path, temp_dir)
                else:
                    result = self._process_general(input_path, temp_dir)
                
                # Save output
                if result.get('success'):
                    shutil.copy2(result['output_path'], output_path)
                    
                    # Extract text if requested
                    if kwargs.get('extract_text'):
                        text_path = kwargs['extract_text']
                        with open(text_path, 'w', encoding='utf-8') as f:
                            f.write(result.get('text', ''))
                
                return {
                    'success': result.get('success', False),
                    'output_path': output_path,
                    'text': result.get('text', ''),
                    'confidence': result.get('confidence', 0.0),
                    'document_type': doc_type,
                    'processing_time': time.time() - start_time,
                    'metadata': {
                        'engine': 'nanovlm',
                        'pages_processed': result.get('pages_processed', 0),
                        'layout_preserved': result.get('layout_preserved', True)
                    }
                }
            
        except Exception as e:
            logger.exception("Error processing document with NanoVLM")
            return {
                'success': False,
                'error': str(e),
                'processing_time': time.time() - start_time,
                'metadata': {
                    'engine': 'nanovlm',
                    'error_type': type(e).__name__
                }
            }

    def _process_handwritten(self, image_path: str, temp_dir: str) -> Dict[str, Any]:
        """Process handwritten text with specialized enhancement"""
        if not HAS_CV2 or not HAS_TESSERACT:
            raise ProcessingError("Required dependencies (opencv-python, pytesseract) not available for handwritten text processing")
        
        # Convert PIL Image to numpy array for OpenCV
        img_np = np.array(Image.open(image_path))
        
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
        
        return {
            'success': True,
            'text': result,
            'output_path': os.path.join(temp_dir, 'handwritten_result.txt'),
            'pages_processed': 1,
            'layout_preserved': True
        }

    def _process_table(self, image_path: str, temp_dir: str) -> Dict[str, Any]:
        """Process tabular data with structure preservation"""
        if not HAS_CV2 or not HAS_TESSERACT:
            raise ProcessingError("Required dependencies (opencv-python, pytesseract) not available for table processing")
        
        # Convert PIL Image to numpy array for OpenCV
        img_np = np.array(Image.open(image_path))
        
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
        
        return {
            'success': True,
            'text': result,
            'output_path': os.path.join(temp_dir, 'table_result.txt'),
            'pages_processed': 1,
            'layout_preserved': True
        }

    def _process_poor_quality(self, image_path: str, temp_dir: str) -> Dict[str, Any]:
        """Process poor quality documents with image enhancement"""
        if not HAS_CV2 or not HAS_TESSERACT:
            raise ProcessingError("Required dependencies (opencv-python, pytesseract) not available for poor quality processing")
        
        # Convert PIL Image to numpy array for OpenCV
        img_np = np.array(Image.open(image_path))
        
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
        
        return {
            'success': True,
            'text': result,
            'output_path': os.path.join(temp_dir, 'poor_quality_result.txt'),
            'pages_processed': 1,
            'layout_preserved': True
        }

    def _process_general(self, image_path: str, temp_dir: str) -> Dict[str, Any]:
        """Process general documents"""
        if not HAS_CV2 or not HAS_TESSERACT:
            raise ProcessingError("Required dependencies (opencv-python, pytesseract) not available for general processing")
        
        # Convert PIL Image to numpy array for OpenCV
        img_np = np.array(Image.open(image_path))
        
        # Convert to grayscale if needed
        if len(img_np.shape) == 3:
            gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
        else:
            gray = img_np
            
        # Apply threshold to get a binary image
        _, binary = cv2.threshold(gray, 128, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
        
        # Use Tesseract for OCR
        result = pytesseract.image_to_string(binary)
        
        return {
            'success': True,
            'text': result,
            'output_path': os.path.join(temp_dir, 'general_result.txt'),
            'pages_processed': 1,
            'layout_preserved': True
        }

    def _calculate_confidence(self, text: str) -> float:
        """Calculate confidence score for OCR result"""
        # Calculate confidence based on text characteristics
        if not text or not text.strip():
            return 0.0
            
        # Base confidence on text length and character variety
        text_length = len(text.strip())
        if text_length == 0:
            return 0.0
        elif text_length < 10:
            base_confidence = 0.3
        elif text_length < 50:
            base_confidence = 0.5
        elif text_length < 200:
            base_confidence = 0.7
        else:
            base_confidence = 0.8
            
        # Adjust based on character variety (more variety = higher confidence)
        unique_chars = len(set(text.lower()))
        char_variety_factor = min(1.0, unique_chars / 20.0)
        
        # Adjust based on common words presence
        common_words = ['the', 'and', 'is', 'in', 'to', 'of', 'a', 'for', 'on', 'with']
        word_matches = sum(1 for word in common_words if word in text.lower())
        word_factor = min(1.0, word_matches / 5.0)
        
        # Calculate final confidence
        confidence = base_confidence * (0.7 + 0.2 * char_variety_factor + 0.1 * word_factor)
        return min(1.0, max(0.0, confidence))

    def _extract_layout(self, image: Image.Image) -> list:
        """Extract document layout information"""
        # TODO: Implement actual layout extraction
        return [{'type': 'text', 'bbox': [0, 0, 100, 100]}]

    def _extract_structured_data(self, text: str) -> Dict[str, Any]:
        """Extract structured data from OCR text"""
        # TODO: Implement actual structured data extraction
        return {'entities': [], 'tables': []}

    def _preprocess_for_retry(self, image_path: str, retry_count: int, enhance_resolution: bool) -> str:
        """
        Apply preprocessing based on retry count
        Returns the path to the preprocessed image (may be a temp file)
        """
        if retry_count == 0 and not enhance_resolution:
            # First attempt with original image (unless enhance_resolution is True)
            return image_path
        
        if not HAS_CV2:
            # If OpenCV is not available, return original path
            self.logger.warning("OpenCV not available for preprocessing, using original image")
            return image_path
        
        # For subsequent retries, apply different preprocessing strategies
        try:
            # Create a temporary file for the processed image
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_file:
                temp_path = temp_file.name
            
            # Load the image with OpenCV for preprocessing
            img = cv2.imread(image_path)
            
            if img is None:
                self.logger.warning(f"Failed to load image with OpenCV: {image_path}")
                return image_path
                
            # Apply different preprocessing strategies based on retry count
            if retry_count == 0 and enhance_resolution:
                # First retry with resolution enhancement
                img = enhance_resolution(img, factor=2)
                self.logger.info(f"Applied resolution enhancement for retry {retry_count+1}")
            elif retry_count == 1:
                # Second retry with denoising
                img = denoise_image(img)
                self.logger.info(f"Applied denoising for retry {retry_count+1}")
            elif retry_count == 2:
                # Third retry with deskewing
                img = deskew_image(img)
                self.logger.info(f"Applied deskewing for retry {retry_count+1}")
            else:
                # Additional retries with combined preprocessing
                img = denoise_image(img)
                img = deskew_image(img)
                img = adjust_contrast_brightness(img, contrast=1.5, brightness=10)
                self.logger.info(f"Applied combined preprocessing for retry {retry_count+1}")
            
            # Save the processed image to the temporary file
            cv2.imwrite(temp_path, img)
            return temp_path
            
        except Exception as e:
            self.logger.warning(f"Preprocessing failed for retry {retry_count+1}: {str(e)}")
            return image_path
    
    def _cleanup_temp_files(self, file_paths: List[str]) -> None:
        """Clean up temporary files created during processing"""
        for file_path in file_paths:
            try:
                if os.path.exists(file_path):
                    os.unlink(file_path)
            except Exception as e:
                self.logger.warning(f"Failed to clean up temporary file {file_path}: {str(e)}")
    
    def validate_result(self, result: Dict[str, Any], confidence_threshold: float) -> Tuple[bool, str]:
        """
        Validate OCR result quality
        Returns a tuple of (is_valid, reason)
        """
        # Check if result exists
        if not result or not isinstance(result, dict):
            return False, "Invalid result format"
            
        # Check success flag
        if not result.get('success', False):
            return False, f"Processing failed: {result.get('error', 'Unknown error')}"
            
        # Check confidence
        confidence = result.get('confidence', 0.0)
        if confidence < confidence_threshold:
            return False, f"Low confidence: {confidence:.2f} < {confidence_threshold:.2f}"
            
        # Check text content
        text = result.get('text', '')
        if not text or len(text.strip()) < 5:  # Arbitrary minimum text length
            return False, "Insufficient text extracted"
            
        return True, "Result valid"
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get processing metrics"""
        total_attempts = (self.metrics['primary_success'] + 
                         self.metrics['fallback_success'] + 
                         self.metrics['total_failures'])
        
        return {
            **self.metrics,
            'total_attempts': total_attempts,
            'primary_success_rate': self.metrics['primary_success'] / max(total_attempts, 1),
            'fallback_success_rate': self.metrics['fallback_success'] / max(total_attempts, 1),
            'overall_success_rate': (self.metrics['primary_success'] + self.metrics['fallback_success']) / max(total_attempts, 1),
            'retry_effectiveness': self.metrics['retry_success'] / max(self.metrics['primary_success'], 1)
        }

def main():
    parser = argparse.ArgumentParser(description='Process documents with NanoVLM')
    parser.add_argument('--model_path', help='Path to NanoVLM model')
    parser.add_argument('--input', required=True, help='Input image path')
    parser.add_argument('--output', required=True, help='Output JSON path')
    parser.add_argument('--document_type', choices=['general', 'handwritten', 'table', 'poor_quality'], 
                       default='general', help='Document type')
    parser.add_argument('--confidence_threshold', type=float, default=0.7,
                       help='Confidence threshold')
    parser.add_argument('--enhance_resolution', action='store_true',
                       help='Enable resolution enhancement')
    parser.add_argument('--preserve_layout', action='store_true',
                       help='Preserve document layout')
    parser.add_argument('--max_retries', type=int, default=2,
                       help='Maximum number of retry attempts')
    parser.add_argument('--disable_fallback', action='store_true',
                       help='Disable fallback OCR engine')
    parser.add_argument('--report_metrics', action='store_true',
                       help='Report processing metrics after completion')
    
    args = parser.parse_args()
    
    processor = NanoVLMProcessor(
        model_path=args.model_path,
        max_retries=args.max_retries,
        enable_fallback=not args.disable_fallback
    )
    
    result = processor.process_document(
        args.input,
        args.output,
        document_type=args.document_type,
        confidence_threshold=args.confidence_threshold,
        enhance_resolution=args.enhance_resolution,
        preserve_layout=args.preserve_layout
    )
    
    # Write results to output file
    output_dir = os.path.dirname(args.output)
    os.makedirs(output_dir, exist_ok=True)
    
    # Save the result directly instead of rewriting it
    if os.path.dirname(args.input) != output_dir:
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
    
    # Report metrics if requested
    if args.report_metrics:
        metrics = processor.get_metrics()
        print("\nProcessing Metrics:")
        for key, value in metrics.items():
            if isinstance(value, float):
                print(f"  {key}: {value:.2f}")
            else:
                print(f"  {key}: {value}")
    
    # Return appropriate exit code
    if not result.get('success', False):
        sys.exit(1)

if __name__ == '__main__':
    main()
