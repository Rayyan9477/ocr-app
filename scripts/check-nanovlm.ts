import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * This script checks the nanoVLM installation and fixes common issues
 */

const VENV_PATH = path.join(process.cwd(), 'nanovlm_env');
const MODEL_DIR = path.join(process.cwd(), 'models', 'nanovlm');

console.log('======== nanoVLM Installation Check ========');

// Check if venv exists
console.log('Checking Python virtual environment...');
const venvExists = fs.existsSync(VENV_PATH);
console.log(`Virtual environment exists: ${venvExists}`);

// Determine Python path
let pythonPath = '';
if (venvExists) {
  pythonPath = path.join(VENV_PATH, process.platform === 'win32' ? 'Scripts\\python.exe' : 'bin/python');
} else {
  console.log('Creating virtual environment...');
  try {
    execSync('python -m venv nanovlm_env', { stdio: 'inherit' });
    pythonPath = path.join(VENV_PATH, process.platform === 'win32' ? 'Scripts\\python.exe' : 'bin/python');
  } catch (error) {
    console.error('Failed to create virtual environment:', error);
  }
}

console.log(`Python path: ${pythonPath}`);
console.log(`Python exists: ${fs.existsSync(pythonPath)}`);

// Check/install dependencies
console.log('\nChecking dependencies...');
try {
  const activateCmd = process.platform === 'win32' 
    ? `"${path.join(VENV_PATH, 'Scripts', 'activate')}"` 
    : `source ${path.join(VENV_PATH, 'bin', 'activate')}`;
  
  console.log('Upgrading pip...');
  execSync(`${process.platform === 'win32' ? pythonPath : activateCmd + ' && python'} -m pip install --upgrade pip`, { stdio: 'inherit' });
  
  console.log('Installing dependencies...');
  execSync(`${process.platform === 'win32' ? pythonPath : activateCmd + ' && python'} -m pip install torch torchvision transformers pillow`, { stdio: 'inherit' });
  
  console.log('Installing nanoVLM...');
  execSync(`${process.platform === 'win32' ? pythonPath : activateCmd + ' && python'} -m pip install git+https://github.com/lusxvr/nanoVLM.git`, { stdio: 'inherit' });
} catch (error) {
  console.error('Error installing dependencies:', error);
}

// Check model files
console.log('\nChecking model files...');
if (!fs.existsSync(MODEL_DIR)) {
  console.log('Model directory not found, creating...');
  fs.mkdirSync(MODEL_DIR, { recursive: true });
}

const modelFiles = fs.existsSync(MODEL_DIR) ? fs.readdirSync(MODEL_DIR) : [];
console.log(`Model files found: ${modelFiles.length > 0 ? modelFiles.join(', ') : 'None'}`);

if (modelFiles.length === 0) {
  console.log('Downloading model weights... (this may take some time)');
  try {
    const cmd = `${process.platform === 'win32' ? pythonPath : 'python'} -c "from huggingface_hub import snapshot_download; snapshot_download('lusxvr/nanoVLM-222M', local_dir='${MODEL_DIR.replace(/\\/g, '/')}')"`;
    execSync(cmd, { stdio: 'inherit' });
  } catch (error) {
    console.error('Error downloading model weights:', error);
  }
}

// Verify installation
console.log('\nVerifying nanoVLM installation...');
try {
  const cmd = `${process.platform === 'win32' ? pythonPath : 'python'} -c "import nanovlm; print('nanoVLM successfully imported')"`;
  execSync(cmd, { stdio: 'inherit' });
  console.log('✅ nanoVLM installation verified successfully!');
} catch (error) {
  console.error('❌ nanoVLM installation verification failed:', error);
}

console.log('\n======== Check Complete ========');
