import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create models directory if it doesn't exist
const modelsDir = path.join(__dirname, '..', 'models');
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
}

console.log('Downloading Paligemma2 model...');
try {
    // Create Python virtual environment
    execSync('python3 -m venv .venv', { stdio: 'inherit' });
    
    // Determine the correct activation command based on OS
    const activateCmd = process.platform === 'win32' 
        ? '.venv\\Scripts\\activate' 
        : 'source .venv/bin/activate';
    
    // Install dependencies
    execSync(`${activateCmd} && pip install --upgrade pip huggingface_hub`, 
        { stdio: 'inherit', shell: true });
    
    // Download model using Hugging Face CLI
    const downloadCommand = `${activateCmd} && python3 -c "
from huggingface_hub import snapshot_download
snapshot_download(
    repo_id='Paligemma/paligemma2-3b-mix-224',
    local_dir='models/paligemma2',
    ignore_patterns=['*.md', '*.txt']
)"`;
    
    execSync(downloadCommand, { stdio: 'inherit', shell: true });
  
  console.log('Successfully downloaded Paligemma2 model');
} catch (error) {
  console.error('Error downloading model:', error);
  process.exit(1);
}
