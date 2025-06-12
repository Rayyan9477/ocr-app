"""
NanoVLM OCR Enhancement Package
- Robust OCR processing with error handling and fallback strategies
- Support for various document types including handwritten text and tables
- Preprocessing capabilities for image enhancement
"""

from .processor import NanoVLMProcessor, OCRError, ImageError, ProcessingError
from .fallback_ocr import FallbackOCR
from .fallback_chain import FallbackChain, create_standard_fallback_chain
from .preprocess_image import (
    enhance_resolution, 
    denoise_image, 
    deskew_image, 
    adjust_contrast_brightness,
    preprocess_image
)
from .analyze import analyze_document

__version__ = '0.2.0'
__all__ = [
    'NanoVLMProcessor',
    'FallbackOCR',
    'FallbackChain',
    'create_standard_fallback_chain',
    'OCRError',
    'ImageError',
    'ProcessingError',
    'enhance_resolution',
    'denoise_image',
    'deskew_image',
    'adjust_contrast_brightness',
    'preprocess_image',
    'analyze_document'
]
