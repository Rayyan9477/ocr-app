#!/usr/bin/env python3
"""
Test confidence data normalization across different formats
"""

import sys
import json
import unittest
from pathlib import Path
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

# Test classes for confidence normalization

def normalize_confidence(confidence_data):
    """
    Normalize confidence data to a consistent format
    
    Args:
        confidence_data: Confidence data that could be a float, int, dict, or None
        
    Returns:
        Dict with normalized confidence data
    """
    # If confidence is a number, convert to standard format
    if isinstance(confidence_data, (int, float)):
        return {
            'averageConfidence': float(confidence_data),
            'pageConfidences': []
        }
    
    # If confidence is None, return default
    if confidence_data is None:
        return {
            'averageConfidence': 0.0,
            'pageConfidences': []
        }
    
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
        
        # Ensure pageConfidences exists
        if 'pageConfidences' not in result:
            result['pageConfidences'] = []
        
        return result
    
    # Fallback for unexpected types
    logger.warning(f"Unexpected confidence data type: {type(confidence_data)}")
    return {
        'averageConfidence': 0.0,
        'pageConfidences': []
    }

class TestConfidenceNormalization(unittest.TestCase):
    """Test the confidence data normalization function"""
    
    def test_numeric_confidence(self):
        """Test normalizing numeric confidence values"""
        # Test with integer
        normalized = normalize_confidence(85)
        self.assertEqual(normalized['averageConfidence'], 85.0)
        self.assertEqual(normalized['pageConfidences'], [])
        
        # Test with float
        normalized = normalize_confidence(92.5)
        self.assertEqual(normalized['averageConfidence'], 92.5)
    
    def test_none_confidence(self):
        """Test normalizing None confidence values"""
        normalized = normalize_confidence(None)
        self.assertEqual(normalized['averageConfidence'], 0.0)
        self.assertEqual(normalized['pageConfidences'], [])
    
    def test_dict_confidence(self):
        """Test normalizing dict confidence values"""
        # Test with averageConfidence already present
        confidence = {
            'averageConfidence': 88.5,
            'pageConfidences': [90.0, 87.0]
        }
        normalized = normalize_confidence(confidence)
        self.assertEqual(normalized['averageConfidence'], 88.5)
        self.assertEqual(normalized['pageConfidences'], [90.0, 87.0])
        
        # Test with overall field
        confidence = {
            'overall': 75.0
        }
        normalized = normalize_confidence(confidence)
        self.assertEqual(normalized['averageConfidence'], 75.0)
        self.assertEqual(normalized['pageConfidences'], [])
        
        # Test with confidence field
        confidence = {
            'confidence': 82.5
        }
        normalized = normalize_confidence(confidence)
        self.assertEqual(normalized['averageConfidence'], 82.5)
        
        # Test with nested confidence
        confidence = {
            'confidence': {
                'averageConfidence': 95.0
            }
        }
        normalized = normalize_confidence(confidence)
        self.assertEqual(normalized['averageConfidence'], 95.0)
    
    def test_legacy_formats(self):
        """Test normalizing legacy confidence formats"""
        # Test Tesseract format
        confidence = {
            'mean_confidence': 80.0,
            'word_confidences': {'hello': 90, 'world': 70}
        }
        normalized = normalize_confidence(confidence)
        self.assertEqual(normalized['averageConfidence'], 0.0)  # Not handled by basic normalizer
        
        # Test with custom fields (should preserve)
        confidence = {
            'averageConfidence': 85.0,
            'engine': 'tesseract',
            'timestamp': 1234567890
        }
        normalized = normalize_confidence(confidence)
        self.assertEqual(normalized['averageConfidence'], 85.0)
        self.assertEqual(normalized['engine'], 'tesseract')
        self.assertEqual(normalized['timestamp'], 1234567890)

def main():
    unittest.main()

if __name__ == "__main__":
    main()
