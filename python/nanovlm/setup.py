from setuptools import setup, find_packages

setup(
    name="nanovlm",
    version="0.2.0",
    packages=find_packages(),
    install_requires=[
        "pillow>=8.0.0",
        "numpy>=1.19.0",
        "opencv-python-headless>=4.5.0",
        "pytesseract>=0.3.8",
        "torch>=1.9.0",
        "transformers>=4.20.0",
        "safetensors>=0.3.0",
        "PyPDF2>=3.0.0"
    ],
    extras_require={
        "gpu": ["torch[cuda]"],
        "dev": ["pytest", "black", "flake8"],
        "metrics": ["pandas>=1.3.0", "matplotlib>=3.3.0"],
        "pdf": ["PyPDF2>=3.0.0"],
        "all": ["pandas>=1.3.0", "matplotlib>=3.3.0", "PyPDF2>=3.0.0"]
    },
    python_requires=">=3.7",
    author="OCR App Team",
    description="NanoVLM OCR package with fallback strategies",
    long_description="A robust OCR package using NanoVLM with fallback to Tesseract OCR",
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
    ],
)
