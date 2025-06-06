import torch
from PIL import Image, ImageEnhance
from transformers import VisionEncoderDecoderModel, AutoTokenizer, ViTImageProcessor

def load_model(model_path):
    print("Loading NanoVLM model...")
    import transformers
    transformers.utils.DOWNLOAD_TIMEOUT = 60
    
    # Load base model first
    model = VisionEncoderDecoderModel.from_pretrained(
        "microsoft/trocr-base-printed",  # Using base model for better compatibility
        local_files_only=False,
        trust_remote_code=True,
        ignore_mismatched_sizes=True
    )
    tokenizer = AutoTokenizer.from_pretrained(
        "microsoft/trocr-base-printed",
        local_files_only=False,
        trust_remote_code=True
    )
    feature_extractor = ViTImageProcessor.from_pretrained(
        "microsoft/trocr-base-printed",
        local_files_only=False,
        trust_remote_code=True
    )
    
    # Load the NanoVLM weights
    print("Loading NanoVLM weights...")
    from safetensors.torch import load_file
    weights = load_file(f"{model_path}/model.safetensors")
    model.load_state_dict(weights, strict=False)
    
    # Move model to GPU if available
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model.to(device)
    return model, tokenizer, feature_extractor, device

def enhance_image(image, method='default'):
    """Enhance image for better text recognition with multiple methods"""
    import numpy as np
    import cv2
    from PIL import ImageEnhance, ImageFilter
    
    # Convert PIL Image to cv2 format
    img_array = np.array(image)
    if len(img_array.shape) == 3:
        img_cv = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
    else:
        img_cv = img_array
        
    if method == 'default':
        # Basic PIL enhancements
        enhancer = ImageEnhance.Contrast(image)
        image = enhancer.enhance(1.5)
        enhancer = ImageEnhance.Sharpness(image)
        image = enhancer.enhance(2.0)
        return image
        
    elif method == 'adaptive':
        # Adaptive thresholding
        gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (7, 7), 0)
        binary = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 13, 2)
        result = cv2.cvtColor(binary, cv2.COLOR_GRAY2RGB)
        return Image.fromarray(result)
        
    elif method == 'otsu':
        # Otsu's thresholding with gamma correction
        gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
        # Apply gamma correction
        gamma = 1.5
        gray = np.power(gray / 255.0, gamma) * 255.0
        gray = gray.astype(np.uint8)
        # Apply Otsu's method
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        result = cv2.cvtColor(binary, cv2.COLOR_GRAY2RGB)
        return Image.fromarray(result)
        
    elif method == 'canny':
        # Edge detection with preprocessing
        gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
        # Denoise first
        denoised = cv2.fastNlMeansDenoising(gray)
        # Apply Canny with automatic threshold detection
        sigma = 0.33
        median = np.median(denoised)
        lower = int(max(0, (1.0 - sigma) * median))
        upper = int(min(255, (1.0 + sigma) * median))
        edges = cv2.Canny(denoised, lower, upper)
        # Dilate edges slightly
        kernel = np.ones((2,2), np.uint8)
        edges = cv2.dilate(edges, kernel, iterations=1)
        result = cv2.cvtColor(edges, cv2.COLOR_GRAY2RGB)
        return Image.fromarray(result)
        
    elif method == 'denoise':
        # Advanced denoising
        denoised = cv2.fastNlMeansDenoisingColored(img_cv, None, 10, 10, 7, 21)
        # Enhance contrast after denoising
        lab = cv2.cvtColor(denoised, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
        l = clahe.apply(l)
        lab = cv2.merge((l,a,b))
        enhanced = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
        result = cv2.cvtColor(enhanced, cv2.COLOR_BGR2RGB)
        return Image.fromarray(result)
    
    return image

def preprocess_for_ocr(image):
    """Apply advanced preprocessing for OCR"""
    import cv2
    import numpy as np
    from PIL import ImageOps
    
    # First, use PIL's autocontrast with reduced cutoff
    image = ImageOps.autocontrast(image, cutoff=0.5)
    
    # Convert to cv2 format
    img_array = np.array(image)
    img_cv = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
    
    # Convert to grayscale
    gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
    
    # Apply CLAHE with reduced clip limit for better contrast
    clahe = cv2.createCLAHE(clipLimit=1.5, tileGridSize=(16,16))
    gray = clahe.apply(gray)
    
    # Normalize image
    normalized = cv2.normalize(gray, None, 0, 255, cv2.NORM_MINMAX)
    
    # Edge enhancement with reduced strength
    edge_enhanced = cv2.Laplacian(normalized, cv2.CV_8U, ksize=3)
    sharpened = cv2.addWeighted(normalized, 1.2, edge_enhanced, -0.3, 0)
    
    # Apply bilateral filter with adjusted parameters
    denoised = cv2.bilateralFilter(sharpened, 7, 50, 50)
    
    # Apply adaptive thresholding with adjusted window size
    thresh = cv2.adaptiveThreshold(
        denoised,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        15,  # Larger window size
        3    # Slightly higher C value
    )
    
    # Morphological operations with smaller kernel
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1,1))
    cleaned = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
    cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_OPEN, kernel)
    
    # Deskew if needed, with more precise angle detection
    coords = np.column_stack(np.where(cleaned > 0))
    if len(coords) > 100:  # Only if we have enough points
        angle = cv2.minAreaRect(coords)[-1]
        if angle < -45:
            angle = 90 + angle
        if abs(angle) > 0.3:  # More sensitive to small angles
            (h, w) = cleaned.shape[:2]
            center = (w // 2, h // 2)
            M = cv2.getRotationMatrix2D(center, angle, 1.0)
            cleaned = cv2.warpAffine(cleaned, M, (w, h), 
                                   flags=cv2.INTER_CUBIC,
                                   borderMode=cv2.BORDER_REPLICATE)
    
    # Add slight contrast boost to final image
    cleaned = cv2.convertScaleAbs(cleaned, alpha=1.1, beta=0)
    
    # Convert back to RGB
    result = cv2.cvtColor(cleaned, cv2.COLOR_GRAY2RGB)
    return Image.fromarray(result)

def fix_perspective(image):
    """Fix perspective distortion in the image"""
    import cv2
    import numpy as np
    
    # Convert to cv2 format
    img_array = np.array(image)
    img_cv = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
    
    # Threshold the image
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    # Find contours
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if contours:
        # Find the largest contour
        largest_contour = max(contours, key=cv2.contourArea)
        
        # Get the minimum area rectangle
        rect = cv2.minAreaRect(largest_contour)
        box = cv2.boxPoints(rect)
        box = box.astype(np.int32)  # Using int32 instead of int0
        
        # Get width and height of the detected rectangle
        width = int(rect[1][0])
        height = int(rect[1][1])
        
        if width > 0 and height > 0:
            src_pts = box.astype("float32")
            # Coordinate of the points in box points after the rectangle has been straightened
            dst_pts = np.array([[0, height-1],
                              [0, 0],
                              [width-1, 0],
                              [width-1, height-1]], dtype="float32")
            
            # The perspective transformation matrix
            matrix = cv2.getPerspectiveTransform(src_pts, dst_pts)
            
            # Directly warp the rotated rectangle to get the straightened rectangle
            warped = cv2.warpPerspective(img_cv, matrix, (width, height))
            
            # Convert back to PIL
            result = cv2.cvtColor(warped, cv2.COLOR_BGR2RGB)
            return Image.fromarray(result)
    
    return image

def prepare_image_variations(image):
    """Create multiple variations of the image for better recognition"""
    variations = []
    
    # Get base preprocessed image
    preprocessed = preprocess_for_ocr(image)
    variations.append(preprocessed)
    
    # Try perspective correction
    perspective_fixed = fix_perspective(preprocessed)
    variations.append(perspective_fixed)
    
    # Add various contrast enhancements
    enhancer = ImageEnhance.Contrast(preprocessed)
    for factor in [0.8, 1.2]:
        variations.append(enhancer.enhance(factor))
    
    # Add sharpness variations
    enhancer = ImageEnhance.Sharpness(preprocessed)
    for factor in [0.8, 1.5]:
        variations.append(enhancer.enhance(factor))
    
    # Add slight rotations of the preprocessed image
    for angle in [-1, -0.5, 0, 0.5, 1]:
        rotated = preprocessed.rotate(angle, expand=True, resample=Image.BICUBIC)
        variations.append(rotated)
    
    # Add resolution variations
    original_size = preprocessed.size
    resolutions = [
        (int(original_size[0] * 1.5), int(original_size[1] * 1.5)),  # Higher res
        (int(original_size[0] * 0.75), int(original_size[1] * 0.75))  # Lower res
    ]
    for size in resolutions:
        scaled = preprocessed.resize(size, Image.LANCZOS)
        variations.append(scaled)
    
    # Add scale variations
    for scale in [0.9, 0.95, 1.0, 1.05, 1.1]:
        new_size = (int(original_size[0] * scale), int(original_size[1] * scale))
        scaled = preprocessed.resize(new_size, Image.LANCZOS)
        variations.append(scaled)
    
    # Add different preprocessing methods
    methods = ['adaptive', 'otsu', 'denoise']
    for method in methods:
        variations.append(enhance_image(preprocessed, method))
    
    # Remove any duplicates
    unique_variations = []
    for var in variations:
        if not any(are_images_similar(var, existing) for existing in unique_variations):
            unique_variations.append(var)
    
    return unique_variations

def are_images_similar(img1, img2, threshold=0.95):
    """Compare two images for similarity to avoid duplicates"""
    import numpy as np
    
    # Convert to numpy arrays
    arr1 = np.array(img1)
    arr2 = np.array(img2)
    
    # Resize to same size if different
    if arr1.shape != arr2.shape:
        arr2 = np.array(img2.resize(img1.size, Image.LANCZOS))
    
    # Calculate normalized cross-correlation
    correlation = np.corrcoef(arr1.flat, arr2.flat)[0,1]
    
    return correlation > threshold

def process_batch(images, model, tokenizer, feature_extractor, device):
    """Process a batch of images and return all predictions with improved beam search"""
    all_texts = []
    for img in images:
        # Prepare image with correct size for model
        pixel_values = feature_extractor(
            img,
            return_tensors="pt",
            size={'height': 384, 'width': 384},  # Fixed size for model
            do_normalize=True
        ).pixel_values.to(device)
        
        # Generate text with supported parameters
        with torch.no_grad():
            outputs = model.generate(
                pixel_values,
                max_length=128,     # Reasonable length for receipts
                num_beams=12,       # Wide beam search
                length_penalty=0.8,  # Slightly favor shorter sequences
                repetition_penalty=1.2,  # Reduced repetition
                early_stopping=True,
                no_repeat_ngram_size=3,  # Avoid repeating trigrams
                num_return_sequences=1,
                pad_token_id=tokenizer.pad_token_id,
                eos_token_id=tokenizer.eos_token_id
            )
        
        # Decode text
        text = tokenizer.decode(outputs[0], skip_special_tokens=True, clean_up_tokenization_spaces=True)
        all_texts.append(text)
    
    # Post-process predictions
    processed_texts = []
    for text in all_texts:
        # Remove extra whitespace
        text = ' '.join(text.split())
        # Remove common OCR artifacts
        text = text.replace('|', 'I').replace('0', 'O')
        # Remove any non-printable characters
        text = ''.join(char for char in text if char.isprintable())
        processed_texts.append(text)
    
    return processed_texts

def process_image(image_path, model, tokenizer, feature_extractor, device):
    """Process image and return text with confidence scores"""
    print(f"Processing image: {image_path}")
    try:
        # Load image
        image = Image.open(image_path).convert("RGB")
        print(f"Image loaded successfully. Original size: {image.size}")
        
        # Create variations
        print("Creating image variations...")
        variations = prepare_image_variations(image)
        print(f"Created {len(variations)} image variations")
        
        # Process batch
        print("Processing image batch...")
        all_texts = process_batch(variations, model, tokenizer, feature_extractor, device)
        
        # Select best text using our improved selection
        best_text, score = select_best_text(all_texts)
        print(f"Text selection complete. Best score: {score:.2f}")
        
        # Get alternative texts (different from best text)
        alternatives = [(text, select_best_text([text])[1]) 
                       for text in all_texts if text != best_text]
        alternatives.sort(key=lambda x: x[1], reverse=True)
        
        return best_text, alternatives[:3]  # Return best text and top 3 alternatives
        
    except Exception as e:
        print(f"Error in image processing: {str(e)}")
        raise
    
    # Clean up the text
    generated_text = ' '.join(generated_text.split())  # Remove extra whitespace
    return generated_text

def select_best_text(texts, min_confidence=0.6):
    """Select the best text from multiple predictions using receipt-specific heuristics"""
    import re
    from collections import Counter
    
    if not texts:
        return None, 0
    
    # Initialize scores dictionary
    scores = {}
    
    # Common receipt-related patterns
    receipt_patterns = [
        (r'total|amount|sum|price', 2.0),           # Common monetary terms
        (r'cash|credit|debit|payment', 1.5),        # Payment terms
        (r'receipt|invoice|bill', 2.0),             # Document types
        (r'cashier|clerk|store|shop', 2.5),         # Service terms - increased weight
        (r'\$\s*\d+\.?\d*', 2.0),                  # Dollar amounts
        (r'\d+\.\d{2}', 1.5),                      # Price-like decimals
        (r'\d{2}[/-]\d{2}[/-]\d{2,4}', 1.0),      # Dates
        (r'tax|vat|gst', 1.5),                     # Tax terms
        (r'item|qty|quantity', 1.0),               # Item details
        (r'subtotal|discount|change', 1.5),        # Transaction terms
    ]
    
    # Suspicious patterns that should be penalized
    suspicious_patterns = [
        (r'^[O0]+\.[O0]+$', 3.0),                # Just zeros/O's with decimal
        (r'^[\d.]+$', 2.0),                      # Just numbers and decimals
        (r'[O0]{3,}', 1.5),                      # Too many zeros or O's in a row
        (r'[^\x20-\x7E]', 1.0),                 # Non-ASCII characters
        (r'[A-Z]{6,}', 0.5),                    # Very long uppercase sequences
        (r'\.{2,}', 1.0),                       # Multiple periods
        (r'^[\d.]+[^\d\s]*$', 2.0),             # Starts with number and has no spaces
    ]
    
    # Get word frequency across all texts
    all_words = []
    for text in texts:
        all_words.extend(text.split())
    word_freq = Counter(all_words)
    
    for text in texts:
        score = 0
        words = text.split()
        
        # Basic length score - slightly favor shorter texts for header items
        text_len_score = min(len(words), 5) * 0.2
        score += text_len_score
        
        # Word frequency score - prefer words that appear multiple times
        freq_score = sum(word_freq[word] for word in words) / len(words) if words else 0
        score += freq_score * 0.3
        
        # Receipt pattern matching
        text_lower = text.lower()
        for pattern, weight in receipt_patterns:
            if re.search(pattern, text_lower):
                score += weight
        
        # Apply penalties for suspicious patterns
        for pattern, penalty in suspicious_patterns:
            if re.search(pattern, text):
                score -= penalty
        
        # Character set score - prefer standard characters with some numbers
        char_score = (
            len([c for c in text if c.isalnum()]) / len(text) if text else 0 +
            len([c for c in text if c.isdigit()]) * 0.2  # Reduced bonus for numbers
        )
        score += char_score
        
        # Case analysis - prefer consistent casing
        if text.isupper() and len(text) > 2:  # Common in headers, but must be longer than 2 chars
            score += 2.0
        elif any(w.isupper() and len(w) > 2 for w in words):  # Some uppercase words
            score += 1.0
        elif text.istitle():  # Title case
            score += 0.5
            
        # Word structure analysis
        for word in words:
            # Penalize words that mix O's and zeros
            if '0' in word and 'O' in word:
                score -= 1.0
            # Penalize words that are just repeated characters
            if word and all(c == word[0] for c in word):
                score -= 1.0
        
        # Store the final score
        scores[text] = max(0, score)  # Ensure non-negative score
    
    # Get the best scoring text
    best_text = max(scores.items(), key=lambda x: x[1])
    
    return best_text[0], best_text[1]

def main():
    model_path = "models/nanovlm-222m"
    test_image = "test_vlm_input.png"
    
    try:
        print("Starting model loading...")
        model, tokenizer, feature_extractor, device = load_model(model_path)
        print(f"Model loaded successfully. Using device: {device}")
        
        print("Starting image processing...")
        best_text, alternatives = process_image(test_image, model, tokenizer, feature_extractor, device)
        
        print("\nRecognized Text (Primary):")
        print("-" * 50)
        print(best_text)
        print("-" * 50)
        
        if alternatives:
            print("\nAlternative Readings:")
            for text, score in alternatives:
                print(f"\nConfidence Score: {score:.2f}")
                print("-" * 30)
                print(text)
            
    except Exception as e:
        import traceback
        print(f"Error: {str(e)}")
        print("Traceback:")
        traceback.print_exc()

if __name__ == "__main__":
    main()
