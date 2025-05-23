#!/bin/bash
# Script to reprocess failed OCR files with enhanced settings

# Default settings
INPUT_DIR="./uploads"
OUTPUT_DIR="./processed"
FAILED_FILE=""
USE_ADVANCED_MODE=true
MAX_RETRIES=3
TIMEOUT=600

# Display help
function show_help {
  echo "Usage: $0 [options] [filename]"
  echo "Options:"
  echo "  -i, --input-dir DIR     Specify input directory (default: ./uploads)"
  echo "  -o, --output-dir DIR    Specify output directory (default: ./processed)" 
  echo "  -f, --file FILENAME     Specify a single file to process"
  echo "  -a, --all               Process all files in input directory"
  echo "  -s, --simple            Use simple OCR mode (less features)"
  echo "  -r, --retries NUM       Maximum number of retries (default: 3)"
  echo "  -t, --timeout SECONDS   Timeout in seconds (default: 600)"
  echo "  -h, --help              Show this help"
  echo ""
  echo "Example: $0 --file Pages_from_Seiba_OV_11_26_2019_CODED_12_3_19_BM_1747831122555.pdf"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -i|--input-dir)
      INPUT_DIR="$2"
      shift 2
      ;;
    -o|--output-dir)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    -f|--file)
      FAILED_FILE="$2"
      shift 2
      ;;
    -a|--all)
      PROCESS_ALL=true
      shift
      ;;
    -s|--simple)
      USE_ADVANCED_MODE=false
      shift
      ;;
    -r|--retries)
      MAX_RETRIES="$2"
      shift 2
      ;;
    -t|--timeout)
      TIMEOUT="$2"
      shift 2
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    *)
      FAILED_FILE="$1"
      shift
      ;;
  esac
done

# Check required directories
if [ ! -d "$INPUT_DIR" ]; then
  echo "Error: Input directory $INPUT_DIR does not exist"
  exit 1
fi

if [ ! -d "$OUTPUT_DIR" ]; then
  echo "Creating output directory $OUTPUT_DIR"
  mkdir -p "$OUTPUT_DIR"
fi

# Function to process a single file
function process_file {
  local input_file="$1"
  local basename=$(basename "$input_file")
  local output_file="${OUTPUT_DIR}/${basename/.pdf/_ocr.pdf}"
  
  echo "Processing file: $basename"
  echo "Input: $input_file"
  echo "Output: $output_file"
  
  # Create a temporary directory for processing
  local temp_dir=$(mktemp -d)
  local temp_input="${temp_dir}/input.pdf"
  local temp_output="${temp_dir}/output.pdf"
  
  echo "Creating temporary copy for processing..."
  cp "$input_file" "$temp_input"
  
  # Basic command
  local cmd="ocrmypdf"
  
  # Add parameters based on mode
  if [ "$USE_ADVANCED_MODE" = true ]; then
    echo "Using advanced OCR mode for medical documents..."
    cmd="$cmd --language eng+osd --deskew --redo-ocr --remove-background --clean --optimize 2 --output-type pdf"
    cmd="$cmd --oversample 400 --tesseract-pagesegmode 1"
    
    # Create tesseract config file
    local config_file="${temp_dir}/medical_config.cfg"
    echo "# Medical document config" > "$config_file"
    echo "textord_heavy_nr 1" >> "$config_file"
    echo "tessedit_char_whitelist 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz,.;:()/-$%#@!&*+=\" '" >> "$config_file"
    echo "tessedit_create_txt 1" >> "$config_file"
    echo "tessedit_create_hocr 1" >> "$config_file"
    
    cmd="$cmd --tesseract-config $config_file"
  else
    echo "Using simple OCR mode..."
    cmd="$cmd --skip-text --output-type pdf --optimize 1"
  fi
  
  # Add input and output files
  cmd="$cmd '$temp_input' '$temp_output'"
  
  echo "Executing OCR command:"
  echo "$cmd"
  
  # Execute with retries
  local attempt=1
  local success=false
  
  while [ $attempt -le $MAX_RETRIES ] && [ "$success" = false ]; do
    echo "Attempt $attempt of $MAX_RETRIES..."
    
    # Run OCR with timeout
    timeout ${TIMEOUT}s bash -c "$cmd" && success=true
    
    if [ "$success" = true ]; then
      echo "OCR completed successfully!"
      
      # Check if output was created
      if [ -f "$temp_output" ] && [ $(stat -c%s "$temp_output") -gt 0 ]; then
        echo "Output file created successfully."
        cp "$temp_output" "$output_file"
        echo "Result saved to: $output_file"
      else
        echo "Error: Output file was not created properly."
        success=false
      fi
    else
      echo "OCR failed on attempt $attempt"
      
      # Modify command for retry
      if [ $attempt -eq 1 ]; then
        echo "Switching to simpler settings for next attempt..."
        cmd="ocrmypdf --force-ocr --optimize 1 '$temp_input' '$temp_output'"
      elif [ $attempt -eq 2 ]; then
        echo "Using minimal settings for final attempt..."
        cmd="ocrmypdf --skip-text '$temp_input' '$temp_output'"
      fi
    fi
    
    ((attempt++))
  done
  
  # Clean up temporary directory
  rm -rf "$temp_dir"
  
  if [ "$success" = true ]; then
    return 0
  else
    return 1
  fi
}

# Process files
if [ -n "$FAILED_FILE" ]; then
  # Process specific file
  if [[ "$FAILED_FILE" != /* ]]; then
    # If not absolute path, assume it's in the input directory
    FAILED_FILE="${INPUT_DIR}/${FAILED_FILE}"
  fi
  
  if [ -f "$FAILED_FILE" ]; then
    process_file "$FAILED_FILE"
    exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
      echo "✅ Successfully processed: $FAILED_FILE"
      exit 0
    else
      echo "❌ Failed to process: $FAILED_FILE"
      exit 1
    fi
  else
    echo "Error: File does not exist: $FAILED_FILE"
    exit 1
  fi
elif [ "$PROCESS_ALL" = true ]; then
  # Process all PDF files in input directory
  echo "Processing all PDF files in $INPUT_DIR"
  success_count=0
  failure_count=0
  
  for file in "$INPUT_DIR"/*.pdf; do
    if [ -f "$file" ]; then
      process_file "$file"
      if [ $? -eq 0 ]; then
        echo "✅ Successfully processed: $file"
        ((success_count++))
      else
        echo "❌ Failed to process: $file"
        ((failure_count++))
      fi
    fi
  done
  
  echo "Processing complete. Success: $success_count, Failures: $failure_count"
  
  if [ $failure_count -gt 0 ]; then
    exit 1
  else
    exit 0
  fi
else
  echo "Error: No file specified and --all not used."
  show_help
  exit 1
fi
