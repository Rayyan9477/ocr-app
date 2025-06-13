#!/usr/bin/env python3
"""
Large PDF Handler for nanoVLM OCR
Special handling for large PDFs to prevent memory issues and improve processing
"""

import os
import json
import tempfile
import logging
import time
from typing import Dict, Any, List, Optional, Tuple
import subprocess
from pathlib import Path

logger = logging.getLogger('nanovlm')

class LargePDFHandler:
    """Handles large PDF files with chunking and parallel processing"""
    
    def __init__(self, config=None):
        """Initialize large PDF handler with optional configuration"""
        self.config = config or {}
        self.chunk_size = self.config.get('chunk_size', 5)  # Pages per chunk
        self.max_workers = self.config.get('max_workers', 2)  # Parallel workers
        self.temp_dir = self.config.get('temp_dir')
        
        # Create temp directory if not provided
        if not self.temp_dir:
            self.temp_dir = tempfile.mkdtemp(prefix="ocr_large_pdf_")
        else:
            os.makedirs(self.temp_dir, exist_ok=True)
    
    def process(self, pdf_path: str, **kwargs) -> Dict[str, Any]:
        """
        Process a large PDF file in chunks
        
        Parameters:
        - pdf_path: Path to the PDF file
        - kwargs: Additional parameters for processing
        
        Returns:
        - Dictionary with OCR results
        """
        start_time = time.time()
        logger.info(f"Processing large PDF: {pdf_path}")
        
        try:
            # Get total page count
            page_count = self._get_pdf_page_count(pdf_path)
            logger.info(f"PDF has {page_count} pages")
            
            if page_count <= 0:
                raise ValueError(f"Invalid PDF file or couldn't determine page count: {pdf_path}")
            
            # Determine if we need to chunk the file
            if page_count <= self.chunk_size:
                logger.info(f"PDF has only {page_count} pages, processing without chunking")
                return self._process_single_chunk(pdf_path, **kwargs)
            
            # Split into chunks
            chunk_ranges = self._calculate_chunk_ranges(page_count)
            logger.info(f"Processing PDF in {len(chunk_ranges)} chunks")
            
            # Process each chunk
            chunk_results = []
            for i, (start_page, end_page) in enumerate(chunk_ranges):
                logger.info(f"Processing chunk {i+1}/{len(chunk_ranges)}: pages {start_page}-{end_page}")
                
                # Extract chunk to temporary PDF
                chunk_path = os.path.join(self.temp_dir, f"chunk_{i+1}.pdf")
                self._extract_pdf_pages(pdf_path, chunk_path, start_page, end_page)
                
                # Process this chunk
                chunk_result = self._process_single_chunk(chunk_path, **kwargs)
                chunk_results.append(chunk_result)
            
            # Combine results
            combined_result = self._combine_chunk_results(chunk_results, page_count)
            
            processing_time = time.time() - start_time
            combined_result['processing_time'] = round(processing_time * 1000)  # ms
            
            return combined_result
            
        except Exception as e:
            logger.error(f"Error processing large PDF: {str(e)}")
            import traceback
            logger.debug(f"Traceback: {traceback.format_exc()}")
            
            return {
                'success': False,
                'error': str(e),
                'error_type': 'LargePDFProcessingError',
                'processing_time': round((time.time() - start_time) * 1000)  # ms
            }
    
    def _get_pdf_page_count(self, pdf_path: str) -> int:
        """Get the total number of pages in a PDF file"""
        try:
            # Using pdftk to get page count
            result = subprocess.run(
                ['pdftk', pdf_path, 'dump_data'],
                capture_output=True,
                text=True,
                check=True
            )
            
            # Find the NumberOfPages line
            for line in result.stdout.split('\n'):
                if line.startswith('NumberOfPages:'):
                    return int(line.split(':')[1].strip())
            
            # Fallback to pdfinfo if pdftk method failed
            result = subprocess.run(
                ['pdfinfo', pdf_path],
                capture_output=True,
                text=True,
                check=True
            )
            
            for line in result.stdout.split('\n'):
                if line.startswith('Pages:'):
                    return int(line.split(':')[1].strip())
            
            raise ValueError("Could not determine page count")
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Error getting PDF page count: {e}")
            
            # Try one more method as last resort
            try:
                from PyPDF2 import PdfReader
                reader = PdfReader(pdf_path)
                return len(reader.pages)
            except Exception as e2:
                logger.error(f"Failed to get page count with PyPDF2 as well: {e2}")
                raise ValueError(f"Could not determine page count: {str(e)}")
    
    def _extract_pdf_pages(self, pdf_path: str, output_path: str, start_page: int, end_page: int) -> None:
        """Extract specific pages from a PDF file"""
        try:
            # Using pdftk to extract pages
            pages_spec = f"{start_page}-{end_page}"
            subprocess.run(
                ['pdftk', pdf_path, 'cat', pages_spec, 'output', output_path],
                capture_output=True,
                check=True
            )
            
            # Verify the output file exists and is valid
            if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
                raise ValueError(f"Failed to extract pages {pages_spec}")
                
        except subprocess.CalledProcessError as e:
            logger.error(f"Error extracting PDF pages: {e}")
            
            # Try alternate method
            try:
                from PyPDF2 import PdfReader, PdfWriter
                reader = PdfReader(pdf_path)
                writer = PdfWriter()
                
                # PyPDF2 uses 0-indexed pages
                for i in range(start_page - 1, end_page):
                    if i < len(reader.pages):
                        writer.add_page(reader.pages[i])
                
                with open(output_path, 'wb') as f:
                    writer.write(f)
                    
            except Exception as e2:
                logger.error(f"Failed to extract pages with PyPDF2 as well: {e2}")
                raise ValueError(f"Could not extract PDF pages: {str(e)}")
    
    def _calculate_chunk_ranges(self, page_count: int) -> List[Tuple[int, int]]:
        """Calculate page ranges for each chunk"""
        chunks = []
        current_page = 1
        
        while current_page <= page_count:
            end_page = min(current_page + self.chunk_size - 1, page_count)
            chunks.append((current_page, end_page))
            current_page = end_page + 1
        
        return chunks
    
    def _process_single_chunk(self, pdf_path: str, **kwargs) -> Dict[str, Any]:
        """Process a single chunk (or the entire PDF if small enough)"""
        # Get processor from kwargs or config
        processor = kwargs.get('processor')
        if not processor:
            raise ValueError("No OCR processor provided for chunk processing")
        
        # Remove processor-related arguments from kwargs to avoid passing them to process_document
        # These are used by the LargePDFHandler but not expected by NanoVLMProcessor.process_document
        process_kwargs = {k: v for k, v in kwargs.items() 
                         if k not in ['processor', 'fallback_processor']}
        
        # Convert PDF chunk to images first (NanoVLMProcessor expects image files)
        images_dir = os.path.join(self.temp_dir, f"images_{os.path.basename(pdf_path)}")
        os.makedirs(images_dir, exist_ok=True)
        
        try:
            # Convert PDF to images using pdftoppm
            subprocess.run(
                ['pdftoppm', '-png', '-r', '300', pdf_path, os.path.join(images_dir, 'page')],
                check=True,
                capture_output=True
            )
            
            # Get list of generated images
            image_files = [f for f in os.listdir(images_dir) if f.endswith('.png')]
            image_files.sort()  # Ensure proper page order
            
            if not image_files:
                raise ValueError(f"No images generated from PDF chunk: {pdf_path}")
            
            # Process each image and combine results
            chunk_results = []
            for image_file in image_files:
                image_path = os.path.join(images_dir, image_file)
                
                # Process this image with the processor
                image_result = processor.process_document(image_path, **process_kwargs)
                chunk_results.append(image_result)
            
            # Combine results from all images in this chunk
            if len(chunk_results) == 1:
                # Single image, return as-is
                return chunk_results[0]
            else:
                # Multiple images, combine them
                combined_result = {
                    'success': all(r.get('success', False) for r in chunk_results),
                    'text': '',
                    'confidence': {'averageConfidence': 0, 'pageCount': len(chunk_results)},
                    'processing_time': sum(r.get('processing_time', 0) for r in chunk_results),
                    'engine': chunk_results[0].get('engine', 'unknown') if chunk_results else 'unknown'
                }
                
                # Combine text and calculate average confidence
                successful_results = [r for r in chunk_results if r.get('success', False)]
                if successful_results:
                    combined_result['text'] = '\n\n'.join(r.get('text', '') for r in successful_results)
                    # Safely calculate average confidence
                    confidence_values = []
                    for r in successful_results:
                        conf = r.get('confidence', 0)
                        if isinstance(conf, (int, float)):
                            confidence_values.append(float(conf))
                        elif isinstance(conf, dict) and 'averageConfidence' in conf:
                            confidence_values.append(float(conf['averageConfidence']))
                        else:
                            confidence_values.append(0.0)
                    
                    if confidence_values:
                        avg_conf = sum(confidence_values) / len(confidence_values)
                        combined_result['confidence']['averageConfidence'] = avg_conf
                
                return combined_result
                
        except subprocess.CalledProcessError as e:
            logger.error(f"Error converting PDF chunk to images: {e}")
            raise ValueError(f"Failed to convert PDF chunk to images: {str(e)}")
        except Exception as e:
            logger.error(f"Error processing PDF chunk: {e}")
            raise
    
    def _combine_chunk_results(self, chunk_results: List[Dict[str, Any]], total_pages: int) -> Dict[str, Any]:
        """Combine results from all chunks into a single result"""
        # Initialize combined result with template from first chunk
        if not chunk_results:
            return {
                'success': False,
                'error': 'No chunks were processed successfully',
                'error_type': 'EmptyChunksError'
            }
        
        combined = {
            'success': all(result.get('success', False) for result in chunk_results),
            'text': '',
            'page_data': [],
            'confidence': {
                'averageConfidence': 0,
                'pageCount': total_pages,
                'pageConfidences': []
            },
            'engine': chunk_results[0].get('engine', 'unknown'),
            'chunks_processed': len(chunk_results),
            'pages_per_chunk': self.chunk_size
        }
        
        # Combine text and confidences
        total_confidence = 0
        successful_chunks = 0
        
        for i, result in enumerate(chunk_results):
            if result.get('success', False):
                # Add chunk text with separator
                chunk_text = result.get('text', '')
                if chunk_text:
                    if combined['text']:
                        combined['text'] += f"\n\n--- Chunk {i+1} ---\n\n"
                    combined['text'] += chunk_text
                
                # Append page data if available
                if 'page_data' in result:
                    combined['page_data'].extend(result['page_data'])
                
                # Combine confidence data
                if 'confidence' in result:
                    try:
                        # Normalize confidence entry so it's always a dict
                        conf = result['confidence']
                        logger.debug(f"Processing confidence data: {conf} (type: {type(conf)})")
                        
                        conf_dict = normalize_confidence(conf)
                        logger.debug(f"Normalized confidence data: {conf_dict}")
                        
                        # Now safely extract values from the normalized dict
                        chunk_confidence = conf_dict.get('averageConfidence', 0.0)
                        page_conf_list = conf_dict.get('pageConfidences', [])
                        
                        # Ensure we're adding numbers, not mixing types
                        if isinstance(chunk_confidence, (int, float)):
                            total_confidence += float(chunk_confidence)
                            successful_chunks += 1
                            logger.debug(f"Added chunk confidence: {chunk_confidence}, total: {total_confidence}")
                        else:
                            logger.warning(f"Skipping non-numeric chunk confidence: {chunk_confidence} (type: {type(chunk_confidence)})")
                        
                        # Add page confidences if available and they're numeric
                        if isinstance(page_conf_list, list):
                            numeric_confidences = [float(conf) for conf in page_conf_list if isinstance(conf, (int, float))]
                            combined['confidence']['pageConfidences'].extend(numeric_confidences)
                            logger.debug(f"Added {len(numeric_confidences)} page confidences")
                        else:
                            logger.warning(f"Page confidences not a list: {page_conf_list} (type: {type(page_conf_list)})")
                    except Exception as conf_error:
                        logger.error(f"Error processing confidence data for chunk {i}: {conf_error}")
                        logger.error(f"Confidence data was: {result.get('confidence', 'None')}")
                        # Continue processing without this chunk's confidence
        
        # Calculate average confidence
        if successful_chunks > 0:
            combined['confidence']['averageConfidence'] = total_confidence / successful_chunks
        
        # Add metadata about partial success if needed
        if not combined['success'] and any(result.get('success', False) for result in chunk_results):
            combined['partial_success'] = True
            combined['success_ratio'] = sum(1 for r in chunk_results if r.get('success', False)) / len(chunk_results)
            
            # Collect errors from failed chunks
            combined['chunk_errors'] = [
                {'chunk': i, 'error': r.get('error', 'Unknown error'), 'error_type': r.get('error_type', 'UnknownError')}
                for i, r in enumerate(chunk_results)
                if not r.get('success', False)
            ]
        
        return combined
    
    def cleanup(self) -> None:
        """Clean up temporary files"""
        if os.path.exists(self.temp_dir):
            try:
                # Remove all files in the temp directory
                for file_path in Path(self.temp_dir).glob('*'):
                    if file_path.is_file():
                        file_path.unlink()
                
                # Remove the directory itself
                os.rmdir(self.temp_dir)
                logger.info(f"Cleaned up temporary directory: {self.temp_dir}")
            except Exception as e:
                logger.error(f"Error cleaning up temporary directory: {e}")

def normalize_confidence(confidence_data) -> Dict[str, Any]:
    """
    Normalize confidence data to a consistent format
    
    Args:
        confidence_data: Confidence data that could be a float, int, dict, or None
        
    Returns:
        Dict with normalized confidence data
    """
    logger.debug(f"Normalizing confidence data: {confidence_data} (type: {type(confidence_data)})")
    
    # If confidence is a number, convert to standard format
    if isinstance(confidence_data, (int, float)):
        result = {
            'averageConfidence': float(confidence_data),
            'pageConfidences': []
        }
        logger.debug(f"Normalized numeric confidence: {result}")
        return result
    
    # If confidence is None, return default
    if confidence_data is None:
        result = {
            'averageConfidence': 0.0,
            'pageConfidences': []
        }
        logger.debug(f"Normalized None confidence: {result}")
        return result
    
    # If confidence is already a dict, ensure it has the required fields
    if isinstance(confidence_data, dict):
        result = dict(confidence_data)  # Create a copy to avoid modifying the original
        
        # Add averageConfidence if missing
        if 'averageConfidence' not in result:
            # Try to extract from other fields
            if 'overall' in result and isinstance(result['overall'], (int, float)):
                result['averageConfidence'] = float(result['overall'])
            elif 'average' in result and isinstance(result['average'], (int, float)):
                result['averageConfidence'] = float(result['average'])
            elif 'confidence' in result and isinstance(result['confidence'], (int, float)):
                result['averageConfidence'] = float(result['confidence'])
            # Handle nested confidence objects
            elif 'confidence' in result and isinstance(result['confidence'], dict) and 'averageConfidence' in result['confidence']:
                result['averageConfidence'] = float(result['confidence']['averageConfidence'])
            else:
                result['averageConfidence'] = 0.0
        
        # Ensure pageConfidences exists and is a list
        if 'pageConfidences' not in result:
            result['pageConfidences'] = []
        elif not isinstance(result['pageConfidences'], list):
            logger.warning(f"pageConfidences is not a list: {result['pageConfidences']}, converting to empty list")
            result['pageConfidences'] = []
        
        # Ensure averageConfidence is numeric
        if not isinstance(result['averageConfidence'], (int, float)):
            logger.warning(f"averageConfidence is not numeric: {result['averageConfidence']}, defaulting to 0.0")
            result['averageConfidence'] = 0.0
        
        logger.debug(f"Normalized dict confidence: {result}")
        return result
    
    # Fallback for unexpected types
    logger.warning(f"Unexpected confidence data type: {type(confidence_data)}, value: {confidence_data}")
    result = {
        'averageConfidence': 0.0,
        'pageConfidences': []
    }
    logger.debug(f"Fallback confidence: {result}")
    return result

def get_pdf_metadata(pdf_path: str) -> Dict[str, Any]:
    """
    Get metadata about a PDF file to help determine processing strategy
    
    Parameters:
    - pdf_path: Path to the PDF file
    
    Returns:
    - Dictionary with PDF metadata
    """
    try:
        # Using pdfinfo to get metadata
        result = subprocess.run(
            ['pdfinfo', pdf_path],
            capture_output=True,
            text=True,
            check=True
        )
        
        metadata = {}
        for line in result.stdout.split('\n'):
            if ':' in line:
                key, value = line.split(':', 1)
                metadata[key.strip()] = value.strip()
        
        # Convert page count to int
        if 'Pages' in metadata:
            metadata['Pages'] = int(metadata['Pages'])
        
        # Convert file size to int (KB)
        if 'File size' in metadata:
            size_str = metadata['File size']
            if 'bytes' in size_str:
                metadata['File size KB'] = int(size_str.split()[0]) / 1024
            elif 'KiB' in size_str:
                metadata['File size KB'] = float(size_str.split()[0])
            elif 'MiB' in size_str:
                metadata['File size KB'] = float(size_str.split()[0]) * 1024
        
        return metadata
    
    except Exception as e:
        logger.error(f"Error getting PDF metadata: {e}")
        return {'error': str(e)}

def is_large_pdf(pdf_path: str, threshold_pages: int = 10, threshold_size_mb: int = 5) -> bool:
    """
    Determine if a PDF should be treated as 'large' based on page count and file size
    
    Parameters:
    - pdf_path: Path to the PDF file
    - threshold_pages: Minimum pages to be considered large
    - threshold_size_mb: Minimum size in MB to be considered large
    
    Returns:
    - True if the PDF is considered large, False otherwise
    """
    try:
        metadata = get_pdf_metadata(pdf_path)
        
        # Check file size (convert KB to MB)
        file_size_mb = metadata.get('File size KB', 0) / 1024
        page_count = metadata.get('Pages', 0)
        
        logger.info(f"PDF file size: {file_size_mb:.2f} MB, Pages: {page_count}")
        
        # Consider large if either threshold is met
        return page_count >= threshold_pages or file_size_mb >= threshold_size_mb
    
    except Exception as e:
        logger.error(f"Error determining if PDF is large: {e}")
        # Default to treating as large if we can't determine size
        return True
