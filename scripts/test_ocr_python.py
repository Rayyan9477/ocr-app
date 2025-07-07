#!/usr/bin/env python3
import os
import subprocess
import sys
from pathlib import Path

def main():
    # Set environment variable
    os.environ['TESSDATA_PREFIX'] = '/usr/local/share/tessdata'
    
    # Print current environment
    print(f"TESSDATA_PREFIX set to: {os.environ.get('TESSDATA_PREFIX')}")
    
    # Test if input file exists (use a simple test image)
    test_image = "/tmp/test_ocr_image.png"
    output_pdf = "/tmp/test_ocr_output.pdf"
    
    # Create a test image if it doesn't exist
    if not Path(test_image).exists():
        print(f"Creating test image: {test_image}")
        try:
            subprocess.run(
                ["convert", "-size", "500x200", "caption:Testing OCR with Python script", test_image],
                check=True,
                capture_output=True,
                text=True
            )
        except subprocess.CalledProcessError as e:
            print(f"Error creating test image: {e.stderr}")
            return 1
    
    # Run OCRmyPDF
    print(f"Running OCRmyPDF on {test_image}")
    try:
        env = os.environ.copy()
        result = subprocess.run(
            [
                "ocrmypdf",
                "--language", "eng",
                "--deskew",
                "--force-ocr",
                test_image,
                output_pdf
            ],
            env=env,
            check=True,
            capture_output=True,
            text=True
        )
        print(f"OCRmyPDF output: {result.stdout}")
        if result.stderr:
            print(f"OCRmyPDF stderr: {result.stderr}")
    except subprocess.CalledProcessError as e:
        print(f"Error running OCRmyPDF: {e.stderr}")
        return 1
    
    # Check if output file was created
    if Path(output_pdf).exists():
        print(f"Success! Output file created: {output_pdf}")
        # Extract text to verify OCR worked
        try:
            result = subprocess.run(
                ["pdftotext", output_pdf, "-"],
                check=True,
                capture_output=True,
                text=True
            )
            print(f"Extracted text: {result.stdout}")
        except subprocess.CalledProcessError as e:
            print(f"Error extracting text: {e.stderr}")
    else:
        print(f"Error: Output file not created: {output_pdf}")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
