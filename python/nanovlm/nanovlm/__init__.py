"""
NanoVLM OCR Package - Nested Module (Deprecated)

WARNING: This nested structure is deprecated. 
Please use the parent nanovlm module instead.
"""

import warnings
import sys
import os

# Add parent directory to path to import from main module
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Issue deprecation warning
warnings.warn(
    "The nested nanovlm.nanovlm module structure is deprecated. "
    "Please import directly from nanovlm instead.",
    DeprecationWarning,
    stacklevel=2
)

# Import from parent module to maintain compatibility
try:
    from ..analyze import analyze_document
    from ..processor import NanoVLMProcessor
except ImportError:
    # Fallback if relative import fails
    from nanovlm.analyze import analyze_document
    from nanovlm.processor import NanoVLMProcessor

__version__ = "0.2.0"
__all__ = ["analyze_document", "NanoVLMProcessor"]
