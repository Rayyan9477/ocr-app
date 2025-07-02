#!/usr/bin/env python3
"""Test script to verify HIPAA OCR API functionality"""

import requests
import io
from PIL import Image

# Create a simple test image
def create_test_image():
    # Create a simple white image with black text
    img = Image.new('RGB', (400, 200), color='white')
    # We'll just create a simple image for testing
    # In a real test, you'd add text using PIL's ImageDraw
    return img

def test_hipaa_api():
    # Test the API endpoint
    url = "http://localhost:3002/api/hipaa-ocr"
    
    # Create test image
    img = create_test_image()
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='PNG')
    img_bytes.seek(0)
    
    # Prepare form data
    files = {
        'files': ('test.png', img_bytes, 'image/png')
    }
    
    data = {
        'language': 'eng',
        'confidenceThreshold': '85',
        'usePreprocessing': 'true',
        'useMultiEngine': 'true'
    }
    
    # Mock session cookie (you'd need a real session token in practice)
    cookies = {
        'hipaa-session': 'test-session-token'
    }
    
    try:
        response = requests.post(url, files=files, data=data, cookies=cookies)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 401:
            print("❌ Authentication required - expected for this test")
        elif response.status_code == 400 and "No files provided" in response.text:
            print("❌ 'No files provided' error - this is the bug we're fixing")
        else:
            print("✅ API endpoint is responding correctly")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_hipaa_api()
