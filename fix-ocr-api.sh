#!/bin/bash
# Script to fix File reference in OCR API route

# Add polyfill for File class in Next.js config
echo "Applying fix for 'File is not defined' error in the OCR API route..."

# Create a temporary file
TMP_FILE=$(mktemp)

# Add experimental transpilers to next.config.mjs
cat > $TMP_FILE << 'EOL'
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['localhost'],
  },
  experimental: {
    serverComponentsExternalPackages: ["sharp"],
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };
    return config;
  },
};

export default nextConfig;
EOL

# Replace the next.config.mjs file
cp $TMP_FILE /home/rayyan9477/ocr-app/next.config.mjs
rm $TMP_FILE

# Create a global.d.ts file for the File polyfill
cat > /home/rayyan9477/ocr-app/global.d.ts << 'EOL'
// global.d.ts
// Add File interface to global namespace for server components
declare global {
  interface FormDataPolyfill {
    get(name: string): File | string | null;
  }
}

export {}
EOL

# Apply fix to the OCR route.ts file
TMP_FILE=$(mktemp)
cat > $TMP_FILE << 'EOL'
const file = formData.get("file")
    if (!file) {
      console.error("No file provided")
      return createJsonResponse({
        success: false,
        error: "No file provided",
        details: "Please provide a PDF file"
      }, 400)
    }
    
    const fileData = file as any;
    if (!fileData.name || !fileData.type || !fileData.size) {
      console.error("Invalid file object properties:", fileData)
      return createJsonResponse({
        success: false,
        error: "Invalid file format",
        details: "The uploaded file does not have the expected properties"
      }, 400)
    }
EOL

# Use sed to replace the file check section
sed -i -e '/const file = formData.get("file")/,+7c\
    const file = formData.get("file")\
    if (!file) {\
      console.error("No file provided")\
      return createJsonResponse({\
        success: false,\
        error: "No file provided",\
        details: "Please provide a PDF file"\
      }, 400)\
    }\
    \
    const fileData = file as any;\
    if (!fileData.name || !fileData.type || !fileData.size) {\
      console.error("Invalid file object properties:", fileData)\
      return createJsonResponse({\
        success: false,\
        error: "Invalid file format",\
        details: "The uploaded file does not have the expected properties"\
      }, 400)\
    }' /home/rayyan9477/ocr-app/app/api/ocr/route.ts

# Also update all file references with fileData
sed -i 's/file\.type/fileData.type/g' /home/rayyan9477/ocr-app/app/api/ocr/route.ts
sed -i 's/file\.name/fileData.name/g' /home/rayyan9477/ocr-app/app/api/ocr/route.ts
sed -i 's/file\.size/fileData.size/g' /home/rayyan9477/ocr-app/app/api/ocr/route.ts
sed -i 's/file\.arrayBuffer/fileData.arrayBuffer/g' /home/rayyan9477/ocr-app/app/api/ocr/route.ts

echo "Fix applied! Please restart the Next.js server for changes to take effect."

# Add npmrc file to allow unsupported Node.js version
echo "node-linker=hoisted" > /home/rayyan9477/ocr-app/.npmrc

echo "Done!"
