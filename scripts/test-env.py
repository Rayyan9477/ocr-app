#!/usr/bin/env python3
import os
import subprocess

# Print current environment
print(f"Current TESSDATA_PREFIX: {os.environ.get('TESSDATA_PREFIX', 'Not set')}")

# Set environment explicitly
os.environ['TESSDATA_PREFIX'] = '/usr/local/share/tessdata'
print(f"Set TESSDATA_PREFIX to: {os.environ.get('TESSDATA_PREFIX')}")

# Run tesseract with explicit environment
cmd = ["tesseract", "--list-langs"]
env = os.environ.copy()
print(f"Running tesseract with environment: TESSDATA_PREFIX={env.get('TESSDATA_PREFIX')}")

result = subprocess.run(cmd, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
print("STDOUT:", result.stdout)
print("STDERR:", result.stderr)
print(f"Exit code: {result.returncode}")

# Try running OCRmyPDF
cmd = ["ocrmypdf", "--language", "eng", "--deskew", "--force-ocr", "/tmp/test.png", "/tmp/test-python.pdf"]
try:
    result = subprocess.run(cmd, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=30)
    print("\nOCRmyPDF STDOUT:", result.stdout)
    print("OCRmyPDF STDERR:", result.stderr)
    print(f"OCRmyPDF Exit code: {result.returncode}")
except subprocess.TimeoutExpired:
    print("OCRmyPDF timed out after 30 seconds")
