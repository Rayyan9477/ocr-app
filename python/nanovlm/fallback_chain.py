#!/usr/bin/env python3
"""
Fallback chain module for nanoVLM OCR
Provides a systematic approach to handle OCR failures with multiple fallback strategies
"""

import os
import sys
import logging
import time
import json
import traceback
from typing import Dict, Any, List, Callable, Optional
from PIL import Image

logger = logging.getLogger('nanovlm')

class FallbackChain:
    """
    A chain of fallback strategies for OCR processing
    """
    
    def __init__(self):
        """Initialize the fallback chain"""
        self.strategies = []
        self.current_strategy = 0
        self.results = []
    
    def add_strategy(self, name: str, strategy_func: Callable, **kwargs) -> None:
        """
        Add a strategy to the fallback chain
        
        Parameters:
        - name: Strategy name for logging
        - strategy_func: Function that implements the strategy
        - kwargs: Additional parameters for the strategy
        """
        self.strategies.append({
            'name': name,
            'func': strategy_func,
            'params': kwargs
        })
    
    def execute(self, image_path: str, document_type: str, **kwargs) -> Dict[str, Any]:
        """
        Execute the fallback chain until a successful result or all strategies are exhausted
        
        Parameters:
        - image_path: Path to the input image
        - document_type: Type of document being processed
        - kwargs: Additional parameters for strategies
        
        Returns:
        - Dictionary with OCR results or error information
        """
        start_time = time.time()
        self.results = []
        
        for i, strategy in enumerate(self.strategies):
            strategy_start = time.time()
            strategy_name = strategy['name']
            strategy_func = strategy['func']
            strategy_params = {**strategy['params'], **kwargs}
            
            logger.info(f"Trying strategy {i+1}/{len(self.strategies)}: {strategy_name}")
            
            try:
                # Execute the strategy
                result = strategy_func(image_path, document_type, **strategy_params)
                strategy_time = time.time() - strategy_start
                
                # Add metadata
                result['strategy'] = strategy_name
                result['strategy_time'] = round(strategy_time * 1000)  # ms
                result['strategy_index'] = i
                
                # Save the result
                self.results.append(result)
                
                # Check if the strategy was successful and should terminate the chain
                if self._is_successful(result, strategy_params.get('confidence_threshold', 0.7)):
                    logger.info(f"Strategy {strategy_name} succeeded with confidence {result.get('confidence', 0):.2f}")
                    result['total_time'] = round((time.time() - start_time) * 1000)  # ms
                    result['strategies_attempted'] = i + 1
                    result['strategies_total'] = len(self.strategies)
                    return result
                else:
                    logger.warning(
                        f"Strategy {strategy_name} completed but did not meet success criteria: "
                        f"{result.get('confidence', 0):.2f} < {strategy_params.get('confidence_threshold', 0.7):.2f}"
                    )
            
            except Exception as e:
                # Log the error and continue to the next strategy
                logger.error(f"Strategy {strategy_name} failed: {str(e)}")
                logger.debug(f"Traceback: {traceback.format_exc()}")
                
                self.results.append({
                    'success': False,
                    'strategy': strategy_name,
                    'strategy_index': i,
                    'error': str(e),
                    'error_type': type(e).__name__,
                    'strategy_time': round((time.time() - strategy_start) * 1000)  # ms
                })
        
        # If we've exhausted all strategies, return the best result we have
        best_result = self._get_best_result()
        
        if best_result:
            best_result['total_time'] = round((time.time() - start_time) * 1000)  # ms
            best_result['strategies_attempted'] = len(self.strategies)
            best_result['strategies_total'] = len(self.strategies)
            best_result['best_effort'] = True
            logger.warning(f"All strategies completed. Returning best result from strategy: {best_result['strategy']}")
            return best_result
        
        # If we have no valid results, return a failure
        logger.error("All strategies failed")
        return {
            'success': False,
            'error': "All OCR strategies failed",
            'error_type': "StrategyExhaustion",
            'total_time': round((time.time() - start_time) * 1000),  # ms
            'strategies_attempted': len(self.strategies),
            'strategies_total': len(self.strategies)
        }
    
    def _is_successful(self, result: Dict[str, Any], confidence_threshold: float) -> bool:
        """Check if a result is successful based on success criteria"""
        return (
            result.get('success', False) and 
            result.get('confidence', 0) >= confidence_threshold and
            result.get('text', '')
        )
    
    def _get_best_result(self) -> Optional[Dict[str, Any]]:
        """Get the best result from all attempted strategies"""
        # Filter for successful results
        successful_results = [r for r in self.results if r.get('success', False)]
        
        if not successful_results:
            return None
        
        # Return the result with highest confidence
        return max(successful_results, key=lambda r: r.get('confidence', 0))
    
    def get_all_results(self) -> List[Dict[str, Any]]:
        """Get all results from executed strategies"""
        return self.results


def create_standard_fallback_chain(primary_processor, fallback_processor):
    """
    Create a standard fallback chain with common strategies
    
    Parameters:
    - primary_processor: Primary OCR processor instance
    - fallback_processor: Fallback OCR processor instance
    
    Returns:
    - Configured FallbackChain instance
    """
    chain = FallbackChain()
    
    # Strategy 1: Primary OCR with original image
    chain.add_strategy(
        name="primary_original",
        strategy_func=lambda img, doc_type, **kwargs: primary_processor.process_document(
            img, document_type=doc_type, enhance_resolution=False, **kwargs
        )
    )
    
    # Strategy 2: Primary OCR with enhanced resolution
    chain.add_strategy(
        name="primary_enhanced",
        strategy_func=lambda img, doc_type, **kwargs: primary_processor.process_document(
            img, document_type=doc_type, enhance_resolution=True, **kwargs
        )
    )
    
    # Strategy 3: Primary OCR with denoising
    chain.add_strategy(
        name="primary_denoised",
        strategy_func=lambda img, doc_type, **kwargs: primary_processor.process_document(
            img, document_type=doc_type, preprocess_options={"denoise": True}, **kwargs
        )
    )
    
    # Strategy 4: Fallback OCR with original image
    chain.add_strategy(
        name="fallback_original",
        strategy_func=lambda img, doc_type, **kwargs: fallback_processor.process(
            img, document_type=doc_type, **kwargs
        )
    )
    
    # Strategy 5: Fallback OCR with enhanced preprocessing
    chain.add_strategy(
        name="fallback_enhanced",
        strategy_func=lambda img, doc_type, **kwargs: fallback_processor.process(
            img, document_type=doc_type, preprocess_options={"enhance": True, "denoise": True}, **kwargs
        )
    )
    
    return chain
