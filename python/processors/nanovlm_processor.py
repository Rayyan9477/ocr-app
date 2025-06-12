#!/usr/bin/env python3
"""
NanoVLM OCR Processor
Handles OCR requests with error handling and enhanced preprocessing
"""

import os
import sys
import logging
import argparse
import json
import torch
from PIL import Image
from typing import Dict, Any
from transformers import AutoModelForVision2Seq, AutoProcessor

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("nanovlm")

def process_image(model_path: str, image_path: str) -> dict:
    try:
        logger.info(f"Loading model from {model_path}")
        model = AutoModelForVision2Seq.from_pretrained(model_path)
        processor = AutoProcessor.from_pretrained(model_path)
        
        device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Using device: {device}")
        
        # Apply CPU optimizations if needed
        if device == "cpu":
            torch.set_num_threads(4)  # Adjust based on available CPU cores
            model = model.float()
        
        model.to(device)
        model.eval()
        torch.set_grad_enabled(False)
        
        logger.info(f"Processing image: {image_path}")
        image = Image.open(image_path)
        inputs = processor(images=image, return_tensors="pt").to(device)
        
        outputs = model.generate(
            **inputs,
            max_length=512,
            num_beams=4,
            length_penalty=1.0,
            early_stopping=True
        )
        
        text = processor.batch_decode(outputs, skip_special_tokens=True)[0]
        
        # Calculate confidence score based on output probabilities
        with torch.no_grad():
            logits = model(**inputs).logits
            probs = torch.softmax(logits, dim=-1)
            confidence = float(probs.max().cpu().numpy())
            
        return {
            "text": text,
            "confidence": confidence * 100,  # Convert to percentage
            "device": device
        }
        
    except Exception as e:
        logger.error(f"Error processing image: {str(e)}")
        return {
            "error": str(e),
            "text": "",
            "confidence": 0.0
        }

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model_path", required=True, help="Path to the model directory")
    parser.add_argument("--image_path", required=True, help="Path to the image file")
    args = parser.parse_args()
    
    # Validate paths
    if not os.path.exists(args.model_path):
        print(json.dumps({"error": f"Model path not found: {args.model_path}"}))
        sys.exit(1)
    if not os.path.exists(args.image_path):
        print(json.dumps({"error": f"Image path not found: {args.image_path}"}))
        sys.exit(1)
    
    try:
        result = process_image(args.model_path, args.image_path)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({
            "error": str(e),
            "text": "",
            "confidence": 0.0
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()
