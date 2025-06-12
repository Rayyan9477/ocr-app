from setuptools import setup, find_packages

setup(
    name="nanovlm",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "torch",
        "torchvision",
        "transformers",
        "Pillow",
        "fastapi",
        "uvicorn"
    ],
)
