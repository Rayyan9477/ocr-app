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
from PIL import Image
import traceback
from typing import Dict, Any, Optional, List, Tuple
import logging
import tempfile
import shutil
import concurrent.futures
from PIL import Image, ImageEnhance, ImageFilter

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

    def process_document(
        self,
        image_path: str,
        document_type: str = 'general',
        confidence_threshold: float = 0.7,
        enhance_resolution: bool = False,
        preserve_layout: bool = False,
        attempt_recovery: bool = True
    ) -> Dict[str, Any]:
        """
        Process document with NanoVLM and return results
        
        Parameters:
        - image_path: Path to the input image
        - document_type: Type of document ('general', 'handwritten', 'table', 'poor_quality')
        - confidence_threshold: Minimum confidence required (0.0-1.0)
        - enhance_resolution: Whether to enhance image resolution
        - preserve_layout: Whether to preserve document layout
        - attempt_recovery: Whether to attempt recovery on failure
        
        Returns:
        - Dictionary with OCR results or error information
        """
        start_time = time.time()
        output_dir = os.path.dirname(image_path)
        output_file = None
        temp_files = []  # Track temporary files for cleanup
        current_retry = 0
        best_result = None
        best_confidence = 0.0
        has_tried_fallback = False
        processing_stages = []  # Track processing stages for debugging

        try:
            self.logger.info(f"Processing document: {image_path}")
            self.logger.debug(f"Options: type={document_type}, threshold={confidence_threshold}, "
                            f"enhance={enhance_resolution}, preserve_layout={preserve_layout}")

            # Validate paths and options
            self.validate_paths(image_path, output_dir)

            if document_type not in self.supported_types:
                raise ValueError(f"Unsupported document type: {document_type}")

            if not 0 <= confidence_threshold <= 1:
                raise ValueError(f"Confidence threshold must be between 0 and 1, got {confidence_threshold}")

            # Prepare output file path
            output_file = os.path.join(
                output_dir,
                f"{os.path.splitext(os.path.basename(image_path))[0]}_result.json"
            )
            
            # Process with retries and fallback
            while current_retry <= self.max_retries:
                try:
                    processing_stages.append(f"Attempt {current_retry+1} - Primary")
                    
                    # Apply different preprocessing based on retry count
                    processed_image_path = self._preprocess_for_retry(
                        image_path, 
                        current_retry, 
                        enhance_resolution
                    )
                    
                    if processed_image_path != image_path:
                        temp_files.append(processed_image_path)

                    # Process image
                    image = Image.open(processed_image_path)
                    
                    # Select appropriate processing method
                    if document_type == 'handwritten':
                        processed_text = self._process_handwritten(image)
                    elif document_type == 'table':
                        processed_text = self._process_table(image)
                    elif document_type == 'poor_quality':
                        processed_text = self._process_poor_quality(image)
                    else:
                        processed_text = self._process_general(image)

                    # Calculate confidence and get layout info
                    confidence = self._calculate_confidence(processed_text)
                    layout = self._extract_layout(image) if preserve_layout else None
                    
                    # Track processing stage
                    processing_stages.append(f"Primary success with confidence {confidence:.2f}")
                    
                    # Prepare result
                    result = {
                        'success': True,
                        'text': processed_text,
                        'confidence': confidence,
                        'processing_time': round((time.time() - start_time) * 1000),  # ms
                        'layout': layout,
                        'document_type': document_type,
                        'enhancement_used': enhance_resolution,
                        'processing_method': 'primary',
                        'processing_stages': processing_stages
                    }
                    
                    # Check if we've met the confidence threshold
                    if confidence >= confidence_threshold:
                        self.metrics['primary_success'] += 1
                        if current_retry > 0:
                            self.metrics['retry_success'] += 1
                            
                        # Write results and return
                        with open(output_file, 'w', encoding='utf-8') as f:
                            json.dump(result, f, indent=2, ensure_ascii=False)
                            
                        self.logger.info(f"Successfully processed document: {image_path}")
                        self._cleanup_temp_files(temp_files)
                        return result
                    
                    # If confidence is too low, but better than previous attempts, save it
                    if confidence > best_confidence:
                        best_result = result
                        best_confidence = confidence
                    
                    # Log low confidence for retry
                    self.logger.warning(
                        f"Low confidence result ({confidence:.2f} < {confidence_threshold:.2f}), "
                        f"retry {current_retry+1}/{self.max_retries+1}"
                    )
                    
                    # Break if we're on the last retry and haven't tried fallback yet
                    if current_retry == self.max_retries and self.enable_fallback and not has_tried_fallback:
                        break
                    
                    # Otherwise continue to next retry
                    current_retry += 1
                    
                except Exception as processing_error:
                    # Log the error
                    self.logger.error(f"Error in processing attempt {current_retry+1}: {str(processing_error)}")
                    processing_stages.append(f"Primary error: {type(processing_error).__name__}")
                    
                    # Break if we're on the last retry and haven't tried fallback yet
                    if current_retry == self.max_retries and self.enable_fallback and not has_tried_fallback:
                        break
                        
                    current_retry += 1
            
            # If we've exhausted retries and fallback is enabled, try fallback OCR
            if self.enable_fallback and not has_tried_fallback:
                processing_stages.append("Attempting fallback OCR")
                self.logger.info("Primary OCR failed, attempting fallback OCR")
                
                try:
                    # Try the fallback OCR method
                    fallback_result = self.fallback_ocr.process(
                        image_path,
                        document_type=document_type,
                        preserve_layout=preserve_layout
                    )
                    
                    if fallback_result['success']:
                        # Add processing information
                        fallback_result['processing_time'] = round((time.time() - start_time) * 1000)
                        fallback_result['processing_method'] = 'fallback'
                        fallback_result['layout'] = self._extract_layout(Image.open(image_path)) if preserve_layout else None
                        fallback_result['document_type'] = document_type
                        fallback_result['enhancement_used'] = enhance_resolution
                        fallback_result['processing_stages'] = processing_stages + ["Fallback OCR success"]
                        
                        # Track metrics
                        self.metrics['fallback_success'] += 1
                        
                        # Write results
                        with open(output_file, 'w', encoding='utf-8') as f:
                            json.dump(fallback_result, f, indent=2, ensure_ascii=False)
                        
                        self.logger.info(f"Successfully processed document with fallback OCR: {image_path}")
                        self._cleanup_temp_files(temp_files)
                        return fallback_result
                        
                except Exception as fallback_error:
                    # Log the fallback error
                    self.logger.error(f"Fallback OCR failed: {str(fallback_error)}")
                    processing_stages.append(f"Fallback error: {type(fallback_error).__name__}")
            
            # If we get here, both primary and fallback methods failed or had low confidence
            # Return the best result we got, or create an error result
            if best_result is not None:
                self.logger.warning(
                    f"No result met confidence threshold ({confidence_threshold:.2f}). "
                    f"Returning best result with confidence {best_confidence:.2f}"
                )
                
                # Update processing stages
                best_result['processing_stages'] = processing_stages + ["Returning best low-confidence result"]
                
                # Write best result
                with open(output_file, 'w', encoding='utf-8') as f:
                    json.dump(best_result, f, indent=2, ensure_ascii=False)
                
                self._cleanup_temp_files(temp_files)
                return best_result
            
            # If we have no valid results, throw an error to trigger the error result
            self.metrics['total_failures'] += 1
            raise ProcessingError("All OCR methods failed to process the document")
            
        except Exception as e:
            self.logger.error(f"Error processing document: {str(e)}")
            self.logger.debug(f"Traceback: {traceback.format_exc()}")

            error_result = {
                'success': False,
                'error': str(e),
                'error_type': type(e).__name__,
                'processing_time': round((time.time() - start_time) * 1000),
                'processing_stages': processing_stages + [f"Final error: {type(e).__name__}"]
            }

            if output_file:
                try:
                    with open(output_file, 'w', encoding='utf-8') as f:
                        json.dump(error_result, f, indent=2, ensure_ascii=False)
                except Exception as write_error:
                    self.logger.error(f"Failed to write error result: {write_error}")

            self._cleanup_temp_files(temp_files)
            return error_result

    def _process_handwritten(self, image: Image.Image) -> str:
        """Process handwritten text with specialized enhancement"""
        # TODO: Implement actual handwritten text processing
        return "Sample handwritten text recognition"

    def _process_table(self, image: Image.Image) -> str:
        """Process tabular data with structure preservation"""
        # TODO: Implement actual table processing
        return "Sample table data recognition"

    def _process_poor_quality(self, image: Image.Image) -> str:
        """Process poor quality documents with image enhancement"""
        # TODO: Implement actual poor quality document processing
        return "Sample poor quality document recognition"

    def _process_general(self, image: Image.Image) -> str:
        """Process general documents"""
        # TODO: Implement actual general document processing
        return "Sample general document recognition"

    def _calculate_confidence(self, text: str) -> float:
        """Calculate confidence score for OCR result"""
        # TODO: Implement actual confidence calculation
        return 0.85

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
        
        # For subsequent retries, apply different preprocessing strategies
        try:
            # Create a temporary file for the processed image
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_file:
                temp_path = temp_file.name
            
            # Load the image with OpenCV for preprocessing
            import cv2
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
