from setuptools import setup, find_packages

setup(
    name="nanovlm",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "torch",
        "transformers",
        "Pillow",
        "numpy",
        "opencv-python-headless",
    ],
    python_requires=">=3.8",
)
