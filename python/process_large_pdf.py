#!/usr/bin/env python3
"""
Large PDF Processing Script
Special handling for large PDFs with proper confidence handling
"""
import argparse
import json
import os
import sys
import tempfile
import time
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional, Union

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("large-pdf-processor")

# Try to import nanovlm modules
try:
    from nanovlm.large_pdf_handler import LargePDFHandler, is_large_pdf
    NANOVLM_AVAILABLE = True
except ImportError:
    logger.warning("nanovlm module not available, using fallback OCR only")
    NANOVLM_AVAILABLE = False


def setup_argparse() -> argparse.Namespace:
    """Set up command line arguments"""
    parser = argparse.ArgumentParser(description="Process large PDF files with OCR")
    parser.add_argument("--input", required=True, help="Input PDF file")
    parser.add_argument("--output", required=True, help="Output PDF file")
    parser.add_argument("--temp-dir", help="Temporary directory for processing")
    parser.add_argument("--document-type", default="general", 
                      help="Document type (general, medical, handwritten, etc.)")
    parser.add_argument("--chunked-processing", action="store_true", 
                      help="Process PDF in chunks")
    parser.add_argument("--engine", help="Preferred OCR engine")
    parser.add_argument("--max-pages-per-chunk", type=int, default=5,
                      help="Maximum pages per chunk")
    parser.add_argument("--confidence-threshold", type=float, default=0.7,
                      help="Confidence threshold for OCR")
    
    return parser.parse_args()


def normalize_confidence(confidence: Union[float, Dict[str, Any]]) -> Dict[str, Any]:
    """
    Normalize confidence data to a consistent format
    
    Args:
        confidence: Confidence data that could be a float or dict
        
    Returns:
        Dict with normalized confidence data
    """
    # If confidence is a float, convert to standard format
    if isinstance(confidence, (int, float)):
        return {
            "averageConfidence": float(confidence)
        }
    
    # If confidence is None, return default
    if confidence is None:
        return {
            "averageConfidence": 0.0
        }
    
    # If confidence is already a dict, ensure it has the required fields
    if isinstance(confidence, dict):
        result = dict(confidence)  # Create a copy to avoid modifying the original
        
        # Add averageConfidence if missing
        if "averageConfidence" not in result:
            # Try to extract from other fields
            if "overall" in result and isinstance(result["overall"], (int, float)):
                result["averageConfidence"] = float(result["overall"])
            elif "average" in result and isinstance(result["average"], (int, float)):
                result["averageConfidence"] = float(result["average"])
            elif "confidence" in result and isinstance(result["confidence"], (int, float)):
                result["averageConfidence"] = float(result["confidence"])
            else:
                result["averageConfidence"] = 0.0
        
        return result
    
    # Fallback for unexpected types
    return {
        "averageConfidence": 0.0
    }


def process_large_pdf(args: argparse.Namespace) -> Dict[str, Any]:
    """
    Process a large PDF file with proper confidence handling
    
    Args:
        args: Command line arguments
        
    Returns:
        Dictionary with processing results
    """
    start_time = time.time()
    
    # Check if the file exists
    if not os.path.exists(args.input):
        return {
            "success": False,
            "error": f"Input file not found: {args.input}"
        }
    
    # Check if the file is a PDF
    if not args.input.lower().endswith(".pdf"):
        return {
            "success": False,
            "error": "Input file must be a PDF"
        }
    
    # Create temp directory if not provided
    temp_dir = args.temp_dir
    if not temp_dir:
        temp_dir = tempfile.mkdtemp(prefix="large_pdf_")
    
    # Ensure output directory exists
    output_dir = os.path.dirname(args.output)
    os.makedirs(output_dir, exist_ok=True)
    
    # Check if we should use nanovlm or fallback
    if NANOVLM_AVAILABLE:
        return process_with_nanovlm(args, temp_dir, start_time)
    else:
        return process_with_fallback(args, temp_dir, start_time)


def process_with_nanovlm(args: argparse.Namespace, temp_dir: str, start_time: float) -> Dict[str, Any]:
    """Process PDF with nanovlm module"""
    try:
        # Initialize the handler
        handler = LargePDFHandler()
        
        # Process the PDF
        result = handler.process_large_pdf(
            input_path=args.input,
            output_path=args.output,
            temp_dir=temp_dir,
            document_type=args.document_type,
            chunked_processing=args.chunked_processing,
            preferred_engine=args.engine,
            max_pages_per_chunk=args.max_pages_per_chunk,
            confidence_threshold=args.confidence_threshold
        )
        
        # Normalize confidence
        if "confidence" in result:
            result["confidence"] = normalize_confidence(result["confidence"])
        
        # Add processing time
        result["processingTime"] = time.time() - start_time
        
        return result
    
    except Exception as e:
        logger.exception("Error processing with nanovlm")
        return {
            "success": False,
            "error": f"Error processing with nanovlm: {str(e)}",
            "processingTime": time.time() - start_time
        }


def process_with_fallback(args: argparse.Namespace, temp_dir: str, start_time: float) -> Dict[str, Any]:
    """Process PDF with fallback OCR methods"""
    try:
        # Import necessary modules
        import subprocess
        from PIL import Image
        import pytesseract
        
        # TODO: Implement fallback OCR using pytesseract
        # For now, return an error
        return {
            "success": False,
            "error": "Fallback OCR not implemented yet",
            "processingTime": time.time() - start_time
        }
    
    except Exception as e:
        logger.exception("Error processing with fallback OCR")
        return {
            "success": False,
            "error": f"Error processing with fallback OCR: {str(e)}",
            "processingTime": time.time() - start_time
        }


def main():
    """Main function"""
    args = setup_argparse()
    
    try:
        # Process the PDF
        result = process_large_pdf(args)
        
        # Print result as JSON
        print(json.dumps(result))
        
        # Return success code
        sys.exit(0 if result.get("success", False) else 1)
    
    except Exception as e:
        logger.exception("Unhandled error in main")
        result = {
            "success": False,
            "error": f"Unhandled error: {str(e)}"
        }
        print(json.dumps(result))
        sys.exit(1)


if __name__ == "__main__":
    main()
