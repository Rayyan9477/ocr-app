#!/usr/bin/env node
/**
 * NanoVLM Setup Script
 * Ensures proper installation and configuration of nanoVLM for the OCR system
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = process.cwd();
const VENV_PATH = path.join(PROJECT_ROOT, 'nanovlm_env');
const MODEL_DIR = path.join(PROJECT_ROOT, 'models', 'nanovlm');
const PYTHON_MODULE_DIR = path.join(PROJECT_ROOT, 'python');
const isWindows = process.platform === 'win32';

console.log('🚀 Setting up nanoVLM OCR integration...\n');

// Helper function to run commands with proper error handling
function runCommand(command: string, description: string, options: any = {}) {
  console.log(`📋 ${description}...`);
  try {
    execSync(command, { 
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options 
    });
    console.log(`✅ ${description} completed\n`);
  } catch (error) {
    console.error(`❌ ${description} failed:`, error instanceof Error ? error.message : error);
    if (!options.optional) {
      process.exit(1);
    }
    console.log(`⚠️  Skipping optional step: ${description}\n`);
  }
}

// Check system requirements
console.log('🔍 Checking system requirements...');

// Check Python installation
try {
  const pythonCmd = isWindows ? 'python' : 'python3';
  const pythonVersion = execSync(`${pythonCmd} --version`, { encoding: 'utf8' });
  console.log(`✅ Found Python: ${pythonVersion.trim()}`);
} catch (error) {
  console.error('❌ Python not found. Please install Python 3.8+ first.');
  process.exit(1);
}

// Check pip
try {
  const pipCmd = isWindows ? 'pip' : 'pip3';
  execSync(`${pipCmd} --version`, { stdio: 'pipe' });
  console.log('✅ pip is available');
} catch (error) {
  console.error('❌ pip not found. Please install pip first.');
  process.exit(1);
}

console.log('');

// Create virtual environment
if (!fs.existsSync(VENV_PATH)) {
  const pythonCmd = isWindows ? 'python' : 'python3';
  runCommand(
    `${pythonCmd} -m venv "${VENV_PATH}"`,
    'Creating Python virtual environment'
  );
} else {
  console.log('✅ Virtual environment already exists\n');
}

// Determine activation command and Python path
const venvPython = isWindows
  ? path.join(VENV_PATH, 'Scripts', 'python.exe')
  : path.join(VENV_PATH, 'bin', 'python');

// Upgrade pip in virtual environment
runCommand(
  `"${venvPython}" -m pip install --upgrade pip`,
  'Upgrading pip in virtual environment'
);

// Install basic dependencies
runCommand(
  `"${venvPython}" -m pip install pillow`,
  'Installing Python imaging library (Pillow)'
);

// Install advanced dependencies (optional for full nanoVLM)
runCommand(
  `"${venvPython}" -m pip install torch torchvision transformers`,
  'Installing ML dependencies (PyTorch, Transformers)',
  { optional: true }
);

// Create model directory
if (!fs.existsSync(MODEL_DIR)) {
  fs.mkdirSync(MODEL_DIR, { recursive: true });
  console.log('✅ Created model directory\n');
} else {
  console.log('✅ Model directory exists\n');
}

// Ensure Python module structure
console.log('📁 Setting up Python module structure...');

const nanovlmModuleDir = path.join(PYTHON_MODULE_DIR, 'nanovlm');
if (!fs.existsSync(nanovlmModuleDir)) {
  fs.mkdirSync(nanovlmModuleDir, { recursive: true });
  console.log('✅ Created nanovlm module directory');
}

// Ensure __init__.py exists
const initFile = path.join(nanovlmModuleDir, '__init__.py');
if (!fs.existsSync(initFile)) {
  fs.writeFileSync(initFile, '# nanoVLM Python module for OCR processing\n');
  console.log('✅ Created __init__.py');
}

// Test the setup
console.log('🧪 Testing nanoVLM setup...');

try {
  const testScript = `
import sys
import os
sys.path.insert(0, '${PYTHON_MODULE_DIR.replace(/\\/g, '\\\\')}')
try:
    from nanovlm.process import mock_nanovlm_process
    print("✅ nanovlm module import successful")
    
    # Test mock processing
    result = mock_nanovlm_process("test_image.jpg", "general")
    print(f"✅ Mock processing test successful - confidence: {result['confidence']}")
    
    print("SUCCESS: nanoVLM setup is working correctly!")
except ImportError as e:
    print(f"❌ Import error: {e}")
    sys.exit(1)
except Exception as e:
    print(f"❌ Test error: {e}")
    sys.exit(1)
`;

  const tempTestFile = path.join(PROJECT_ROOT, 'temp_test_nanovlm.py');
  fs.writeFileSync(tempTestFile, testScript);
  
  execSync(`"${venvPython}" "${tempTestFile}"`, { stdio: 'inherit' });
  
  // Clean up test file
  fs.unlinkSync(tempTestFile);
  
  console.log('\n🎉 nanoVLM setup completed successfully!');
  console.log('\n📋 Setup Summary:');
  console.log(`   • Virtual environment: ${VENV_PATH}`);
  console.log(`   • Python executable: ${venvPython}`);
  console.log(`   • Model directory: ${MODEL_DIR}`);
  console.log(`   • Python module: ${nanovlmModuleDir}`);
  console.log('\n🚀 You can now use nanoVLM in your OCR workflows!');
  
} catch (error) {
  console.error('\n❌ Setup test failed:', error instanceof Error ? error.message : error);
  console.log('\n🔧 Troubleshooting tips:');
  console.log('   • Ensure Python 3.8+ is installed');
  console.log('   • Check that pip is working correctly');
  console.log('   • Verify virtual environment activation');
  console.log('   • Check file permissions in project directory');
  process.exit(1);
}
