import logging
import os
from datetime import datetime

# Create logs directory if it doesn't exist
log_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'logs')
os.makedirs(log_dir, exist_ok=True)

# Configure logging
log_file = os.path.join(log_dir, f'nanovlm_{datetime.now().strftime("%Y%m%d")}.log')

# Create logger
logger = logging.getLogger('nanovlm')
logger.setLevel(logging.DEBUG)

# Create handlers
file_handler = logging.FileHandler(log_file)
console_handler = logging.StreamHandler()

# Set levels
file_handler.setLevel(logging.DEBUG)
console_handler.setLevel(logging.INFO)

# Create formatters
file_formatter = logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s'
)
console_formatter = logging.Formatter(
    '%(levelname)s: %(message)s'
)

# Add formatters to handlers
file_handler.setFormatter(file_formatter)
console_handler.setFormatter(console_formatter)

# Add handlers to logger
logger.addHandler(file_handler)
logger.addHandler(console_handler)

def log_error(error, context=None):
    """Log error with context"""
    if context:
        logger.error(f"{error} - Context: {context}")
    else:
        logger.error(error)

def log_warning(message, context=None):
    """Log warning with context"""
    if context:
        logger.warning(f"{message} - Context: {context}")
    else:
        logger.warning(message)

def log_info(message):
    """Log info message"""
    logger.info(message)

def log_debug(message):
    """Log debug message"""
    logger.debug(message)
