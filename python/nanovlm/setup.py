from setuptools import setup, find_packages

setup(
    name="nanovlm",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "pillow",
        "numpy",
        "torch",
        "transformers",
        "safetensors",
        "opencv-python-headless"
    ],
    author="OCR App Team",
    description="NanoVLM OCR package"
)
