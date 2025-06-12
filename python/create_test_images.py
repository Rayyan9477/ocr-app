#!/usr/bin/env python3
"""
Create test images for OCR testing with different characteristics
"""

import os
import sys
import argparse
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

def create_test_image(output_path, text, size=(800, 600), noise=0, blur=0, rotation=0, 
                     quality=100, skew=False, is_handwritten=False, has_table=False):
    """Create a test image with the specified characteristics"""
    # Create a blank image
    img = Image.new('RGB', size, color='white')
    draw = ImageDraw.Draw(img)
    
    # Choose font
    try:
        if is_handwritten:
            # Try to use a handwriting-like font
            font_path = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'  # Default fallback
            for path in [
                '/usr/share/fonts/truetype/fonts-japanese-gothic.ttf',
                '/usr/share/fonts/TTF/Comic.ttf',
                '/usr/share/fonts/truetype/tlwg/Loma.ttf'
            ]:
                if os.path.exists(path):
                    font_path = path
                    break
        else:
            font_path = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
            
        # Use a smaller font for tables
        font_size = 14 if has_table else 24
        font = ImageFont.truetype(font_path, font_size)
    except:
        # Fallback to default font
        font = ImageFont.load_default()
    
    # Draw table if requested
    if has_table:
        # Draw table borders
        table_margin = 50
        cell_height = 40
        num_rows = 5
        num_cols = 3
        col_width = (size[0] - 2 * table_margin) / num_cols
        
        # Draw horizontal lines
        for i in range(num_rows + 1):
            y = table_margin + i * cell_height
            draw.line([(table_margin, y), (size[0] - table_margin, y)], fill='black', width=2)
        
        # Draw vertical lines
        for i in range(num_cols + 1):
            x = table_margin + i * col_width
            draw.line([(x, table_margin), (x, table_margin + num_rows * cell_height)], fill='black', width=2)
        
        # Add sample data to the table
        headers = ["Column 1", "Column 2", "Column 3"]
        
        # Draw headers
        for i, header in enumerate(headers):
            x = table_margin + i * col_width + 10
            y = table_margin + 10
            draw.text((x, y), header, fill='black', font=font)
        
        # Draw data rows
        for row in range(1, num_rows):
            for col in range(num_cols):
                x = table_margin + col * col_width + 10
                y = table_margin + row * cell_height + 10
                cell_text = f"Row {row}, Col {col+1}"
                draw.text((x, y), cell_text, fill='black', font=font)
    else:
        # Draw text
        if isinstance(text, list):
            # Multiple lines of text
            y = 50
            for line in text:
                # Center text horizontally
                text_width = draw.textlength(line, font=font)
                x = (size[0] - text_width) / 2
                draw.text((x, y), line, fill='black', font=font)
                y += 40
        else:
            # Single line of text, centered
            text_width = draw.textlength(text, font=font)
            x = (size[0] - text_width) / 2
            y = (size[1] - 24) / 2
            draw.text((x, y), text, fill='black', font=font)
    
    # Apply skew if requested
    if skew:
        # Skew the image by shifting the top right and bottom left corners
        skew_factor = 0.1
        width, height = img.size
        
        # Calculate the four corners of the skewed image
        corners = [
            (0, 0),  # Top left
            (width, int(height * skew_factor)),  # Top right
            (int(width * skew_factor), height),  # Bottom left
            (width, height)  # Bottom right
        ]
        
        # Apply perspective transform
        img = img.transform(size, Image.QUAD, corners)
    
    # Apply rotation if requested
    if rotation != 0:
        img = img.rotate(rotation, resample=Image.BICUBIC, expand=False)
    
    # Apply blur if requested
    if blur > 0:
        img = img.filter(ImageFilter.GaussianBlur(radius=blur))
    
    # Apply noise if requested
    if noise > 0:
        # Create a noise layer
        noise_img = Image.new('RGB', size, color='white')
        noise_data = []
        for _ in range(size[0] * size[1]):
            noise_value = int(np.random.normal(128, noise * 50))
            noise_value = max(0, min(255, noise_value))
            noise_data.extend([noise_value, noise_value, noise_value])
        
        # Create the noise image
        noise_img.putdata([(r, g, b) for r, g, b in zip(*[iter(noise_data)]*3)])
        
        # Blend the images
        img = Image.blend(img, noise_img, noise * 0.5)
    
    # Adjust quality for poor_quality images
    if quality < 100:
        # Reduce contrast
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(quality / 100)
        
        # Reduce brightness
        enhancer = ImageEnhance.Brightness(img)
        img = enhancer.enhance(max(0.7, quality / 100))
    
    # Save the image
    img.save(output_path, quality=int(quality))
    print(f"Created test image: {output_path}")
    return output_path

def main():
    parser = argparse.ArgumentParser(description='Create test images for OCR testing')
    parser.add_argument('--output_dir', default='sample_images', help='Output directory')
    parser.add_argument('--create_all', action='store_true', help='Create all test image types')
    
    args = parser.parse_args()
    
    # Create output directory
    os.makedirs(args.output_dir, exist_ok=True)
    
    # Sample text
    general_text = "This is a sample text for OCR testing."
    long_text = [
        "NanoVLM OCR Test Document",
        "This document is used to test OCR capabilities",
        "It contains multiple lines of text",
        "With different formatting and content",
        "To validate the OCR system's performance"
    ]
    
    # Create test images
    create_test_image(
        os.path.join(args.output_dir, "normal.png"),
        long_text,
        noise=0,
        blur=0,
        rotation=0,
        quality=100
    )
    
    create_test_image(
        os.path.join(args.output_dir, "rotated.png"),
        general_text,
        noise=0,
        blur=0,
        rotation=5,
        quality=100
    )
    
    create_test_image(
        os.path.join(args.output_dir, "poor_quality.png"),
        general_text,
        noise=0.3,
        blur=1.5,
        rotation=2,
        quality=70
    )
    
    create_test_image(
        os.path.join(args.output_dir, "handwritten.png"),
        "This is a simulation of handwritten text for testing",
        noise=0.1,
        blur=0.5,
        rotation=3,
        quality=90,
        is_handwritten=True
    )
    
    create_test_image(
        os.path.join(args.output_dir, "table.png"),
        "",
        size=(1000, 600),
        noise=0,
        blur=0,
        rotation=0,
        quality=100,
        has_table=True
    )
    
    create_test_image(
        os.path.join(args.output_dir, "skewed.png"),
        long_text,
        noise=0.1,
        blur=0,
        rotation=0,
        quality=90,
        skew=True
    )
    
    create_test_image(
        os.path.join(args.output_dir, "extreme.png"),
        "This text is extremely hard to read due to poor quality",
        noise=0.4,
        blur=2.0,
        rotation=8,
        quality=50,
        skew=True
    )
    
    print(f"Created all test images in {args.output_dir}")

if __name__ == '__main__':
    main()
