"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var child_process_1 = require("child_process");
var fs = require("fs");
var path = require("path");
/**
 * This script checks the nanoVLM installation and fixes common issues
 */
var VENV_PATH = path.join(process.cwd(), 'nanovlm_env');
var MODEL_DIR = path.join(process.cwd(), 'models', 'nanovlm');
console.log('======== nanoVLM Installation Check ========');
// Check if venv exists
console.log('Checking Python virtual environment...');
var venvExists = fs.existsSync(VENV_PATH);
console.log("Virtual environment exists: ".concat(venvExists));
// Determine Python path
var pythonPath = '';
if (venvExists) {
    pythonPath = path.join(VENV_PATH, process.platform === 'win32' ? 'Scripts\\python.exe' : 'bin/python');
}
else {
    console.log('Creating virtual environment...');
    try {
        (0, child_process_1.execSync)('python -m venv nanovlm_env', { stdio: 'inherit' });
        pythonPath = path.join(VENV_PATH, process.platform === 'win32' ? 'Scripts\\python.exe' : 'bin/python');
    }
    catch (error) {
        console.error('Failed to create virtual environment:', error);
    }
}
console.log("Python path: ".concat(pythonPath));
console.log("Python exists: ".concat(fs.existsSync(pythonPath)));
// Check/install dependencies
console.log('\nChecking dependencies...');
try {
    var activateCmd = process.platform === 'win32'
        ? "\"".concat(path.join(VENV_PATH, 'Scripts', 'activate'), "\"")
        : "source ".concat(path.join(VENV_PATH, 'bin', 'activate'));
    console.log('Upgrading pip...');
    (0, child_process_1.execSync)("".concat(process.platform === 'win32' ? pythonPath : activateCmd + ' && python', " -m pip install --upgrade pip"), { stdio: 'inherit' });
    console.log('Installing dependencies...');
    (0, child_process_1.execSync)("".concat(process.platform === 'win32' ? pythonPath : activateCmd + ' && python', " -m pip install torch torchvision transformers pillow"), { stdio: 'inherit' });
    console.log('Installing nanoVLM...');
    (0, child_process_1.execSync)("".concat(process.platform === 'win32' ? pythonPath : activateCmd + ' && python', " -m pip install git+https://github.com/lusxvr/nanoVLM.git"), { stdio: 'inherit' });
}
catch (error) {
    console.error('Error installing dependencies:', error);
}
// Check model files
console.log('\nChecking model files...');
if (!fs.existsSync(MODEL_DIR)) {
    console.log('Model directory not found, creating...');
    fs.mkdirSync(MODEL_DIR, { recursive: true });
}
var modelFiles = fs.existsSync(MODEL_DIR) ? fs.readdirSync(MODEL_DIR) : [];
console.log("Model files found: ".concat(modelFiles.length > 0 ? modelFiles.join(', ') : 'None'));
if (modelFiles.length === 0) {
    console.log('Downloading model weights... (this may take some time)');
    try {
        var cmd = "".concat(process.platform === 'win32' ? pythonPath : 'python', " -c \"from huggingface_hub import snapshot_download; snapshot_download('lusxvr/nanoVLM-222M', local_dir='").concat(MODEL_DIR.replace(/\\/g, '/'), "')\"");
        (0, child_process_1.execSync)(cmd, { stdio: 'inherit' });
    }
    catch (error) {
        console.error('Error downloading model weights:', error);
    }
}
// Verify installation
console.log('\nVerifying nanoVLM installation...');
try {
    var cmd = "".concat(process.platform === 'win32' ? pythonPath : 'python', " -c \"import nanovlm; print('nanoVLM successfully imported')\"");
    (0, child_process_1.execSync)(cmd, { stdio: 'inherit' });
    console.log('✅ nanoVLM installation verified successfully!');
}
catch (error) {
    console.error('❌ nanoVLM installation verification failed:', error);
}
console.log('\n======== Check Complete ========');
