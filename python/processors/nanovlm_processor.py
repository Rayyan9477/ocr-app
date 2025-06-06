#!/usr/bin/env python3

import argparse
import json
import sys
import torch
from transformers import AutoModelForVision2Seq, AutoProcessor
from PIL import Image
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def process_image(model_path: str, image_path: str) -> dict:
    try:
        logger.info(f"Loading model from {model_path}")
        model = AutoModelForVision2Seq.from_pretrained(model_path)
        processor = AutoProcessor.from_pretrained(model_path)
        
        device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Using device: {device}")
        model.to(device)
        
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
            confidence = float(torch.mean(torch.max(probs, dim=-1).values))
        
        return {
            "text": text,
            "confidence": confidence,
            "metadata": {
                "model": "nanovlm-222m",
                "device": device,
                "image_size": image.size
            }
        }
    except Exception as e:
        logger.error(f"Error processing image: {str(e)}")
        return {"error": str(e)}

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model_path", required=True, help="Path to the model directory")
    parser.add_argument("--image_path", required=True, help="Path to the image file")
    args = parser.parse_args()
    
    try:
        result = process_image(args.model_path, args.image_path)
        print(json.dumps(result, ensure_ascii=False))
