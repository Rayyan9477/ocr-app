#!/usr/bin/env python3
"""
Smart OCR command-line interface for nanoVLM
Provides enhanced OCR processing with automatic fallback, error handling, and large PDF support
"""

import argparse
import os
import sys
import json
import logging
import time
from pathlib import Path
from typing import Dict, Any, List
import time
import glob
from typing import Dict, Any, List, Optional
import traceback

# Add the parent directory to the path so we can import nanovlm
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from nanovlm import (
    NanoVLMProcessor,
    FallbackOCR,
    FallbackChain,
    create_standard_fallback_chain,
    analyze_document
)
from nanovlm.large_pdf_handler import LargePDFHandler, is_large_pdf
from nanovlm.logger import logger

def process_files(args):
    """Process files according to command-line arguments"""
    # Configure processors
    primary_processor = NanoVLMProcessor(
        model_path=args.model_path,
        max_retries=args.max_retries,
        enable_fallback=not args.disable_fallback
    )
    fallback_processor = FallbackOCR() if not args.disable_fallback else None
    
    # Create output directory
    if args.output_dir:
        os.makedirs(args.output_dir, exist_ok=True)
    
    # Find input files - support PDFs for large PDF handling
    input_files = []
    for pattern in args.input:
        # Check if it's a directory
        if os.path.isdir(pattern):
            for ext in ['.png', '.jpg', '.jpeg', '.tiff', '.bmp', '.pdf']:
                input_files.extend(glob.glob(os.path.join(pattern, f'*{ext}')))
        # Check if it's a glob pattern
        elif '*' in pattern or '?' in pattern or '[' in pattern:
            input_files.extend(glob.glob(pattern))
        # Single file
        elif os.path.isfile(pattern):
            input_files.append(pattern)
        else:
            logger.warning(f"Input pattern did not match any files: {pattern}")
    
    # Remove duplicates
    input_files = sorted(set(input_files))
    
    if not input_files:
        logger.error("No input files found")
        return 1
    
    logger.info(f"Processing {len(input_files)} files")
    
    # Process each file
    results = []
    errors = []
    
    for i, file_path in enumerate(input_files):
        try:
            logger.info(f"Processing file {i+1}/{len(input_files)}: {file_path}")
            
            # Check if this is a PDF file that should use large PDF handling
            is_pdf = file_path.lower().endswith('.pdf')
            use_large_pdf_handler = (args.handle_large_pdf or args.chunked_processing) and is_pdf
            
            # For large PDF handling, check if the PDF is actually large
            if use_large_pdf_handler and not args.chunked_processing:
                # Only use large PDF handler if the PDF is actually large
                use_large_pdf_handler = is_large_pdf(file_path)
                if not use_large_pdf_handler:
                    logger.info(f"PDF {file_path} is not large, using standard processing")
            
            # Determine document type if automatic
            doc_type = args.document_type
            if doc_type == 'auto' and not is_pdf:
                try:
                    analysis = analyze_document(file_path)
                    logger.info(f"Document analysis: {analysis}")
                    
                    # Determine type based on analysis
                    if analysis.get('hasHandwriting', False):
                        doc_type = 'handwritten'
                    elif analysis.get('hasTables', False):
                        doc_type = 'table'
                    elif analysis.get('poorQuality', False):
                        doc_type = 'poor_quality'
                    else:
                        doc_type = 'general'
                        
                    logger.info(f"Auto-detected document type: {doc_type}")
                except Exception as e:
                    logger.warning(f"Document analysis failed, using general type: {e}")
                    doc_type = 'general'
            elif doc_type == 'auto':
                doc_type = 'general'  # Default for PDFs
            
            # Determine output path
            if args.output_file and len(input_files) == 1:
                # Use specific output file name for single file processing
                if args.output_dir:
                    output_path = os.path.join(args.output_dir, args.output_file)
                else:
                    output_path = args.output_file
            elif args.output_dir:
                base_name = os.path.splitext(os.path.basename(file_path))[0]
                if is_pdf and use_large_pdf_handler:
                    output_path = os.path.join(args.output_dir, f"{base_name}_ocr_large.pdf")
                else:
                    output_path = os.path.join(args.output_dir, f"{base_name}_result.json")
            else:
                output_dir = os.path.dirname(file_path)
                base_name = os.path.splitext(os.path.basename(file_path))[0]
                if is_pdf and use_large_pdf_handler:
                    output_path = os.path.join(output_dir, f"{base_name}_ocr_large.pdf")
                else:
                    output_path = os.path.join(output_dir, f"{base_name}_result.json")
            
            # Process with large PDF handler if needed
            if use_large_pdf_handler:
                logger.info(f"Using large PDF handler for {file_path}")
                
                # Create LargePDFHandler
                pdf_handler = LargePDFHandler(config={
                    'chunk_size': 5,  # Pages per chunk
                    'max_workers': 2
                })
                
                try:
                    result = pdf_handler.process(
                        file_path,
                        processor=primary_processor,
                        document_type=doc_type,
                        confidence_threshold=args.confidence_threshold,
                        preserve_layout=args.preserve_layout,
                        fallback_processor=fallback_processor
                    )
                    
                    # Clean up
                    pdf_handler.cleanup()
                    
                except Exception as e:
                    logger.error(f"Large PDF processing failed: {e}")
                    # Clean up
                    pdf_handler.cleanup()
                    
                    # Fall back to standard processing if large PDF handling fails
                    logger.info("Falling back to standard processing")
                    use_large_pdf_handler = False
            
            # Use standard processing if not using large PDF handler
            if not use_large_pdf_handler:
                # Use fallback chain if advanced mode is enabled
                if args.advanced and not args.disable_fallback:
                    chain = create_standard_fallback_chain(primary_processor, fallback_processor)
                    result = chain.execute(
                        file_path,
                        document_type=doc_type,
                        confidence_threshold=args.confidence_threshold,
                        preserve_layout=args.preserve_layout
                    )
                else:
                    # Use standard processing
                    result = primary_processor.process_document(
                        file_path,
                        document_type=doc_type,
                        confidence_threshold=args.confidence_threshold,
                        enhance_resolution=args.enhance_resolution,
                        preserve_layout=args.preserve_layout
                    )
            
            # Add metadata
            result['file_path'] = file_path
            result['output_path'] = output_path
            result['document_type'] = doc_type
            result['advanced_mode'] = args.advanced
            result['large_pdf_mode'] = use_large_pdf_handler
            if args.engine:
                result['requested_engine'] = args.engine
            
            # Save the result as JSON (always save JSON for API compatibility)
            json_output_path = output_path
            if output_path.endswith('.pdf'):
                json_output_path = output_path.replace('.pdf', '.json')
            
            with open(json_output_path, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
            
            # For large PDF processing, also create the PDF if text is available
            if use_large_pdf_handler and result.get('success', False) and result.get('text'):
                try:
                    # Create a simple text-based PDF output
                    # This is a placeholder - in a real implementation, you might want to
                    # create a proper PDF with the OCR'd text overlaid on the original pages
                    with open(output_path.replace('.pdf', '_text.txt'), 'w', encoding='utf-8') as f:
                        f.write(result['text'])
                    logger.info(f"Text output saved to {output_path.replace('.pdf', '_text.txt')}")
                except Exception as e:
                    logger.warning(f"Could not create text output: {e}")
            
            results.append(result)
            
            if not result.get('success', False):
                errors.append({
                    'file_path': file_path,
                    'error': result.get('error', 'Unknown error')
                })
        
        except Exception as e:
            logger.error(f"Error processing file {file_path}: {e}")
            logger.debug(traceback.format_exc())
            errors.append({
                'file_path': file_path,
                'error': str(e)
            })
    
    # Output the final result as JSON for API compatibility
    if len(input_files) == 1 and args.output_file:
        # For single file with specific output, print the result JSON to stdout
        final_result = results[0] if results else {
            'success': False,
            'error': 'No results generated',
            'file_path': input_files[0] if input_files else 'unknown'
        }
        print(json.dumps(final_result, indent=2, ensure_ascii=False))
    
    # Print summary
    success_count = len(results) - len(errors)
    logger.info(f"Processing complete: {success_count}/{len(input_files)} files successful")
    
    if args.report_metrics:
        print("\nProcessing Metrics:")
        print(f"  Total files: {len(input_files)}")
        print(f"  Success: {success_count}")
        print(f"  Errors: {len(errors)}")
        if len(input_files) > 0:
            print(f"  Success rate: {success_count/len(input_files):.2f}")
        
        # Print processor metrics if available
        try:
            metrics = primary_processor.get_metrics()
            print("\nProcessor Metrics:")
            for key, value in metrics.items():
                if isinstance(value, float):
                    print(f"  {key}: {value:.2f}")
                else:
                    print(f"  {key}: {value}")
        except Exception as e:
            logger.debug(f"Could not get processor metrics: {e}")
    
    if args.error_report and errors:
        error_report_path = os.path.join(args.output_dir or os.getcwd(), "error_report.json")
        with open(error_report_path, 'w', encoding='utf-8') as f:
            json.dump(errors, f, indent=2, ensure_ascii=False)
        logger.info(f"Error report saved to: {error_report_path}")
    
    return 0 if not errors else 1

def main():
    parser = argparse.ArgumentParser(description='Smart OCR with nanoVLM')
    parser.add_argument('--model_path', help='Path to nanoVLM model')
    parser.add_argument('--input', required=True, nargs='+',
                       help='Input image paths, directories, or glob patterns')
    parser.add_argument('--output_dir', help='Output directory for results')
    parser.add_argument('--output_file', help='Specific output filename (for single file processing)')
    parser.add_argument('--document_type', choices=['auto', 'general', 'handwritten', 'table', 'poor_quality'], 
                       default='auto', help='Document type or "auto" for automatic detection')
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
    parser.add_argument('--advanced', action='store_true',
                       help='Use advanced processing with fallback chain')
    parser.add_argument('--handle_large_pdf', action='store_true',
                       help='Enable large PDF handling with chunking')
    parser.add_argument('--chunked_processing', action='store_true',
                       help='Enable chunked processing for large PDFs')
    parser.add_argument('--engine', choices=['nanovlm', 'tesseract'], 
                       help='Preferred OCR engine')
    parser.add_argument('--report_metrics', action='store_true',
                       help='Report processing metrics after completion')
    parser.add_argument('--error_report', action='store_true',
                       help='Generate a JSON report of all errors')
    parser.add_argument('--log_level', choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'],
                       default='INFO', help='Set logging level')
    
    args = parser.parse_args()
    
    # Configure logging
    log_level = getattr(logging, args.log_level)
    logger.setLevel(log_level)
    
    return process_files(args)

if __name__ == '__main__':
    sys.exit(main())
