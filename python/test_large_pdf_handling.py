#!/usr/bin/env python3
"""
Test large PDF handling and metrics collection for the enhanced OCR system
This script will test both the LargePDFHandler and MetricsAggregator
"""

import os
import sys
import json
import time
import logging
import argparse
from pathlib import Path

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from nanovlm.processor import NanoVLMProcessor
from nanovlm.fallback_ocr import FallbackOCR
from nanovlm.fallback_chain import create_standard_fallback_chain
from nanovlm.large_pdf_handler import LargePDFHandler, is_large_pdf
from nanovlm.metrics_aggregator import MetricsAggregator

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('test_large_pdf')

def setup_test_environment():
    """Set up the test environment and return paths to test files"""
    # Create test directory
    test_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'test_data')
    os.makedirs(test_dir, exist_ok=True)
    
    # Check if we have test PDFs
    test_pdfs = list(Path(test_dir).glob('*.pdf'))
    
    if not test_pdfs:
        logger.info("No test PDFs found, generating some test files...")
        
        # Check if we have a PDF creation script
        pdf_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'create_test_pdf.py')
        
        if os.path.exists(pdf_script):
            logger.info(f"Using {pdf_script} to create test PDFs")
            os.system(f"python3 {pdf_script} --output {test_dir}/test_10page.pdf --pages 10")
            os.system(f"python3 {pdf_script} --output {test_dir}/test_3page.pdf --pages 3")
            
            test_pdfs = list(Path(test_dir).glob('*.pdf'))
        else:
            logger.warning("No PDF creation script found, please provide test PDFs manually")
    
    return test_dir, test_pdfs

def test_large_pdf_handler(pdf_path, metrics_aggregator):
    """Test the LargePDFHandler with a PDF file"""
    logger.info(f"Testing LargePDFHandler with {pdf_path}")
    
    # Initialize processors
    primary_processor = NanoVLMProcessor(enable_fallback=True, max_retries=1)
    fallback_processor = FallbackOCR()
    
    # Create LargePDFHandler
    pdf_handler = LargePDFHandler(config={
        'chunk_size': 3,  # Small chunk size for testing
        'max_workers': 2
    })
    
    # Check if the PDF is large (using test-specific threshold for small test files)
    if not is_large_pdf(pdf_path, threshold_pages=2, threshold_size_mb=1):
        logger.warning(f"PDF {pdf_path} is not considered large, but testing anyway")
    
    # Process the PDF
    try:
        result = pdf_handler.process(
            pdf_path,
            processor=primary_processor,
            document_type='general',
            fallback_processor=fallback_processor
        )
        
        # Add result to metrics
        metrics_aggregator.add_result(result, 'pdf')
        
        # Print result summary
        logger.info(f"Processing result: success={result.get('success', False)}")
        if result.get('success', False):
            logger.info(f"Extracted text length: {len(result.get('text', ''))}")
            
            # Handle confidence which may be numeric or dict
            conf_raw = result.get('confidence', 0)
            if isinstance(conf_raw, (int, float)):
                avg_conf = conf_raw
            else:
                avg_conf = conf_raw.get('averageConfidence', 0)
            logger.info(f"Average confidence: {avg_conf:.2f}")
            logger.info(f"Chunks processed: {result.get('chunks_processed', 0)}")
        else:
            logger.error(f"Processing failed: {result.get('error', 'Unknown error')}")
        
        # Clean up temporary files
        pdf_handler.cleanup()
        
        return result
    
    except Exception as e:
        logger.error(f"Error during large PDF processing: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {'success': False, 'error': str(e)}

def test_fallback_chain_with_metrics(image_path, metrics_aggregator):
    """Test the FallbackChain with metrics collection"""
    logger.info(f"Testing FallbackChain with {image_path}")
    
    # Initialize processors
    primary_processor = NanoVLMProcessor(enable_fallback=True, max_retries=1)
    fallback_processor = FallbackOCR()
    
    # Create fallback chain
    chain = create_standard_fallback_chain(primary_processor, fallback_processor)
    
    # Process the image
    try:
        result = chain.execute(
            image_path,
            document_type='general',
            confidence_threshold=0.6
        )
        
        # Add result to metrics
        metrics_aggregator.add_result(result, 'image')
        
        # Print result summary
        logger.info(f"Processing result: success={result.get('success', False)}")
        if result.get('success', False):
            logger.info(f"Strategy used: {result.get('strategy', 'unknown')}")
            logger.info(f"Confidence: {result.get('confidence', 0):.2f}")
            logger.info(f"Strategies attempted: {result.get('strategies_attempted', 0)}/{result.get('strategies_total', 0)}")
        else:
            logger.error(f"Processing failed: {result.get('error', 'Unknown error')}")
        
        return result
    
    except Exception as e:
        logger.error(f"Error during fallback chain processing: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {'success': False, 'error': str(e)}

def generate_metrics_report(metrics_aggregator, output_dir):
    """Generate a metrics report"""
    logger.info("Generating metrics report")
    
    # Get summary metrics
    summary = metrics_aggregator.get_summary()
    logger.info(f"Overall success rate: {summary['overall_success_rate']:.2f}%")
    logger.info(f"Documents processed: {summary['documents_processed']}")
    
    # Generate HTML report
    report_path = metrics_aggregator.generate_report(output_dir)
    if report_path:
        logger.info(f"Metrics report generated at: {report_path}")
    else:
        logger.warning("Failed to generate metrics report")

def main():
    """Main test function"""
    parser = argparse.ArgumentParser(description="Test large PDF handling and metrics collection")
    parser.add_argument("--pdf", help="Path to a specific PDF file to test")
    parser.add_argument("--image", help="Path to a specific image file to test")
    parser.add_argument("--output", help="Output directory for results", default="./test_results")
    args = parser.parse_args()
    
    # Create output directory
    os.makedirs(args.output, exist_ok=True)
    
    # Initialize metrics aggregator
    metrics_aggregator = MetricsAggregator(metrics_dir=os.path.join(args.output, 'metrics'))
    
    # If specific files are provided, test them
    if args.pdf:
        test_large_pdf_handler(args.pdf, metrics_aggregator)
    
    if args.image:
        test_fallback_chain_with_metrics(args.image, metrics_aggregator)
    
    # Otherwise, set up test environment and test with generated files
    if not args.pdf and not args.image:
        test_dir, test_pdfs = setup_test_environment()
        
        if test_pdfs:
            # Test with first PDF
            test_large_pdf_handler(str(test_pdfs[0]), metrics_aggregator)
            
            # If we have images to test with, test those too
            test_images = list(Path(test_dir).glob('*.png')) + list(Path(test_dir).glob('*.jpg'))
            if test_images:
                test_fallback_chain_with_metrics(str(test_images[0]), metrics_aggregator)
        else:
            logger.error("No test files available. Please provide test files with --pdf or --image")
    
    # Generate metrics report
    generate_metrics_report(metrics_aggregator, args.output)

if __name__ == "__main__":
    main()
