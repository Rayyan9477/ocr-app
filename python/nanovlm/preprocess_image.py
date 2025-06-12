#!/usr/bin/env python3
"""
Image preprocessing module for nanoVLM OCR optimization
"""

import argparse
import cv2
import numpy as np
from PIL import Image, ImageEnhance
import sys
import os

def enhance_resolution(image, factor=2):
    """Enhance image resolution using super-resolution techniques"""
    height, width = image.shape[:2]
    new_height, new_width = height * factor, width * factor
    return cv2.resize(image, (new_width, new_height), interpolation=cv2.INTER_CUBIC)

def denoise_image(image):
    """Remove noise from image using Non-local Means Denoising"""
    if len(image.shape) == 3:
        return cv2.fastNlMeansDenoisingColored(image, None, 10, 10, 7, 21)
    else:
        return cv2.fastNlMeansDenoising(image, None, 10, 7, 21)

def deskew_image(image):
    """Correct skew in document images"""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
    
    # Use HoughLines to detect text lines
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)
    lines = cv2.HoughLines(edges, 1, np.pi/180, threshold=100)
    
    if lines is not None:
        angles = []
        for line in lines[:20]:  # Use first 20 lines
            rho, theta = line[0]  # Unpack from the array
            angle = theta * 180 / np.pi
            if angle < 45:
                angles.append(angle)
            elif angle > 135:
                angles.append(angle - 180)
        
        if angles:
            median_angle = np.median(angles)
            if abs(median_angle) > 0.5:  # Only rotate if significant skew
                (h, w) = image.shape[:2]
                center = (w // 2, h // 2)
                M = cv2.getRotationMatrix2D(center, median_angle, 1.0)
                image = cv2.warpAffine(image, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    
    return image

def adjust_contrast_brightness(image, contrast=1.0, brightness=0):
    """Adjust image contrast and brightness"""
    if contrast != 1.0 or brightness != 0:
        image = cv2.convertScaleAbs(image, alpha=contrast, beta=brightness)
    return image

def preprocess_image(input_path, output_path, **options):
    """Main preprocessing function"""
    try:
        # Load image
        image = cv2.imread(input_path)
        if image is None:
            raise ValueError(f"Could not load image from {input_path}")
        
        print(f"Processing image: {input_path}")
        print(f"Original size: {image.shape}")
        
        # Apply preprocessing steps based on options
        if options.get('enhance_resolution', False):
            print("Enhancing resolution...")
            image = enhance_resolution(image)
        
        if options.get('denoise', False):
            print("Denoising image...")
            image = denoise_image(image)
        
        if options.get('deskew', False):
            print("Deskewing image...")
            image = deskew_image(image)
        
        contrast = options.get('contrast', 1.0)
        brightness = options.get('brightness', 0)
        if contrast != 1.0 or brightness != 0:
            print(f"Adjusting contrast ({contrast}) and brightness ({brightness})...")
            image = adjust_contrast_brightness(image, contrast, brightness)
        
        # Save processed image
        cv2.imwrite(output_path, image)
        print(f"Processed image saved to: {output_path}")
        print(f"Final size: {image.shape}")
        
        return output_path
        
    except Exception as e:
        print(f"Error preprocessing image: {e}", file=sys.stderr)
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description='Preprocess images for nanoVLM OCR')
    parser.add_argument('input_path', help='Input image path')
    parser.add_argument('output_path', help='Output image path')
    parser.add_argument('--enhance-resolution', action='store_true', help='Enhance image resolution')
    parser.add_argument('--denoise', action='store_true', help='Remove noise from image')
    parser.add_argument('--deskew', action='store_true', help='Correct image skew')
    parser.add_argument('--contrast', type=float, default=1.0, help='Contrast adjustment factor')
    parser.add_argument('--brightness', type=int, default=0, help='Brightness adjustment')
    
    args = parser.parse_args()
    
    # Create output directory if it doesn't exist
    os.makedirs(os.path.dirname(args.output_path), exist_ok=True)
    
    # Process image
    preprocess_image(
        args.input_path,
        args.output_path,
        enhance_resolution=args.enhance_resolution,
        denoise=args.denoise,
        deskew=args.deskew,
        contrast=args.contrast,
        brightness=args.brightness
    )

if __name__ == '__main__':
    main()
