#!/usr/bin/env python3
"""
NanoVLM OCR Processing Script

This script uses NanoVLM for high-quality OCR processing of documents,
with fallback to standard OCR methods if NanoVLM is not available.
"""

import os
import sys
import time
import argparse
import logging
from typing import Dict, Any, List, Optional, Tuple
import json
import tempfile
import shutil

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('nanovlm-processor')

# Try to import nanovlm modules
try:
    from nanovlm.large_pdf_handler import LargePDFHandler, is_large_pdf
    from nanovlm.ocr import OCRProcessor, OCROptions
    NANOVLM_AVAILABLE = True
except ImportError:
    logger.warning("nanovlm module not available, using fallback OCR only")
    NANOVLM_AVAILABLE = False

# Try to import fallback libraries
try:
    import pytesseract
    from pdf2image import convert_from_path
    import cv2
    import numpy as np
    from PIL import Image
    FALLBACK_AVAILABLE = True
except ImportError:
    logger.warning("Fallback OCR libraries not available")
    FALLBACK_AVAILABLE = False


def parse_arguments() -> argparse.Namespace:
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description='Process documents with NanoVLM OCR')
    
    parser.add_argument('--input', '-i', required=True, help='Input file path')
    parser.add_argument('--output', '-o', required=True, help='Output PDF path')
    parser.add_argument('--extract-text', '-t', help='Output text file path')
    parser.add_argument('--lang', '-l', default='eng', help='Language(s) for OCR')
    parser.add_argument('--dpi', '-d', type=int, default=300, help='DPI for image processing')
    parser.add_argument('--force-fallback', action='store_true', help='Force fallback OCR')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    
    return parser.parse_args()


def main() -> int:
    """Main processing function"""
    args = parse_arguments()
    
    if args.verbose:
        logger.setLevel(logging.DEBUG)
    
    # Check input file
    if not os.path.exists(args.input):
        logger.error(f"Input file not found: {args.input}")
        return 1
    
    # Create temp directory for processing
    with tempfile.TemporaryDirectory() as temp_dir:
        start_time = time.time()
        
        # Select processing method
        if NANOVLM_AVAILABLE and not args.force_fallback:
            result = process_with_nanovlm(args, temp_dir, start_time)
        elif FALLBACK_AVAILABLE:
            result = process_with_fallback(args, temp_dir, start_time)
        else:
            logger.error("No OCR processing methods available")
            return 1
        
        # Handle processing result
        if result.get('success', False):
            logger.info(f"Processing completed successfully in {time.time() - start_time:.2f} seconds")
            return 0
        else:
            logger.error(f"Processing failed: {result.get('error', 'Unknown error')}")
            return 1


def process_with_nanovlm(args: argparse.Namespace, temp_dir: str, start_time: float) -> Dict[str, Any]:
    """Process PDF with nanovlm module"""
    try:
        logger.info(f"Processing {args.input} with NanoVLM")
        
        # Initialize OCR options
        ocr_options = OCROptions(
            lang=args.lang,
            dpi=args.dpi,
            output_text=bool(args.extract_text)
        )
        
        # Initialize OCR processor
        processor = OCRProcessor(options=ocr_options)
        
        # Process document
        result = processor.process_document(
            input_path=args.input,
            output_path=args.output
        )
        
        # Extract text if requested
        if args.extract_text and result.get('success'):
            if 'text' in result:
                with open(args.extract_text, 'w', encoding='utf-8') as f:
                    f.write(result['text'])
            else:
                logger.warning("Text extraction requested but no text available in result")
                # Try to extract text from the output PDF
                try:
                    import subprocess
                    subprocess.run(['pdftotext', args.output, args.extract_text], check=True)
                except Exception as e:
                    logger.warning(f"Failed to extract text using pdftotext: {e}")
        
        # Add processing time to result
        result['processing_time'] = time.time() - start_time
        
        return result
        
    except Exception as e:
        logger.exception("Error processing with nanovlm")
        return {
            'success': False,
            'error': f"Error processing with nanovlm: {str(e)}",
            'processing_time': time.time() - start_time
        }


def process_with_fallback(args: argparse.Namespace, temp_dir: str, start_time: float) -> Dict[str, Any]:
    """Process with pytesseract when nanovlm is not available"""
    try:
        logger.info(f"Processing {args.input} with fallback OCR")
        
        # Check if it's a PDF or image
        _, ext = os.path.splitext(args.input.lower())
        
        if ext == '.pdf':
            # Convert PDF to images
            logger.info("Converting PDF to images")
            images = convert_from_path(args.input, dpi=args.dpi)
            
            # Process each image
            text_parts = []
            image_paths = []
            
            for i, image in enumerate(images):
                # Save image to temp file
                image_path = os.path.join(temp_dir, f'page_{i+1:03d}.png')
                image.save(image_path, 'PNG')
                image_paths.append(image_path)
                
                # Use pytesseract for OCR
                text = pytesseract.image_to_string(image, lang=args.lang)
                text_parts.append(text)
            
            # Combine text parts
            full_text = '\n\n--- Page Break ---\n\n'.join(text_parts)
            
            # Save to output text file if requested
            if args.extract_text:
                with open(args.extract_text, 'w', encoding='utf-8') as f:
                    f.write(full_text)
            
            # Create PDF with OCR using pytesseract
            logger.info("Creating PDF with OCR")
            
            # Use pdf2image and img2pdf to create searchable PDF
            pdf_pages = []
            for i, image_path in enumerate(image_paths):
                # Create hOCR for this page
                hocr = pytesseract.image_to_pdf_or_hocr(
                    Image.open(image_path),
                    extension='pdf',
                    lang=args.lang
                )
                
                # Save hOCR PDF
                page_pdf = os.path.join(temp_dir, f'page_{i+1:03d}.pdf')
                with open(page_pdf, 'wb') as f:
                    f.write(hocr)
                pdf_pages.append(page_pdf)
            
            # Merge PDFs
            import subprocess
            pdftk_cmd = ['pdftk']
            pdftk_cmd.extend(pdf_pages)
            pdftk_cmd.extend(['cat', 'output', args.output])
            
            subprocess.run(pdftk_cmd, check=True)
            
            return {
                'success': True,
                'output': args.output,
                'text': full_text if args.extract_text else None,
                'pages': len(images),
                'processing_time': time.time() - start_time
            }
            
        else:
            # Process single image
            image = Image.open(args.input)
            
            # Use pytesseract for OCR
            text = pytesseract.image_to_string(image, lang=args.lang)
            
            # Save to output text file if requested
            if args.extract_text:
                with open(args.extract_text, 'w', encoding='utf-8') as f:
                    f.write(text)
            
            # Create PDF with OCR
            pdf_data = pytesseract.image_to_pdf_or_hocr(
                image,
                extension='pdf',
                lang=args.lang
            )
            
            with open(args.output, 'wb') as f:
                f.write(pdf_data)
            
            return {
                'success': True,
                'output': args.output,
                'text': text if args.extract_text else None,
                'pages': 1,
                'processing_time': time.time() - start_time
            }
            
    except Exception as e:
        logger.exception("Error in fallback processing")
        return {
            'success': False,
            'error': f"Fallback processing failed: {str(e)}",
            'processing_time': time.time() - start_time
        }


if __name__ == "__main__":
    sys.exit(main())
