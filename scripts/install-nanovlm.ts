import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

// Configuration
const VENV_PATH = path.join(process.cwd(), 'nanovlm_env');
const MODEL_DIR = path.join(process.cwd(), 'models', 'nanovlm');
const MODEL_REPO = 'lusxvr/nanoVLM-222M';

// Create virtual environment
console.log('Creating Python virtual environment...');
if (!fs.existsSync(VENV_PATH)) {
  execSync('python -m venv nanovlm_env');
}

// Determine activation command based on platform
const isWindows = process.platform === 'win32';
const activateCommand = isWindows 
  ? `"${path.join(VENV_PATH, 'Scripts', 'activate')}" && `
  : `source ${path.join(VENV_PATH, 'bin', 'activate')} && `;

// Install dependencies
console.log('Installing dependencies...');
try {
  execSync(`${activateCommand} pip install --upgrade pip`);
  execSync(`${activateCommand} pip install torch torchvision transformers pillow`);
  execSync(`${activateCommand} pip install git+https://github.com/lusxvr/nanoVLM.git`);
} catch (error) {
  console.error('Failed to install dependencies:', error);
  process.exit(1);
}

// Download model weights
console.log(`Downloading model weights from ${MODEL_REPO}...`);
if (!fs.existsSync(MODEL_DIR)) {
  fs.mkdirSync(MODEL_DIR, { recursive: true });
}

try {
  execSync(`${activateCommand} python -c "from huggingface_hub import snapshot_download; snapshot_download('${MODEL_REPO}', local_dir='${MODEL_DIR}')"`, { stdio: 'inherit' });
  console.log(`Model weights downloaded to ${MODEL_DIR}`);
} catch (error) {
  console.error('Failed to download model weights:', error);
  process.exit(1);
}

// Verify installation
console.log('Verifying installation...');
try {
  execSync(`${activateCommand} python -c "from nanovlm import load_model; print('NanoVLM installation verified')"`, { stdio: 'inherit' });
  console.log('Installation complete!');
} catch (error) {
  console.error('Installation verification failed:', error);
  process.exit(1);
}
