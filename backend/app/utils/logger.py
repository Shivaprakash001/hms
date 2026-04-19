"""
Centralized logging configuration
"""
import logging
import sys
from pathlib import Path
from datetime import datetime
from pythonjsonlogger.json import JsonFormatter

# Create logs directory if it doesn't exist
LOGS_DIR = Path(__file__).parent.parent.parent.parent / "logs"
LOGS_DIR.mkdir(exist_ok=True)

# Configure logging format
# Include request attributes that might be set by the context or logger
LOG_FORMAT = "%(asctime)s %(levelname)s %(name)s %(module)s %(message)s %(request_id)s %(user_id)s %(latency)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

# Create formatters
# Using JSON formatter
formatter = JsonFormatter(
    fmt=LOG_FORMAT,
    datefmt=DATE_FORMAT,
    rename_fields={"levelname": "level"}
)

# Console handler
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setLevel(logging.INFO)
console_handler.setFormatter(formatter)

# File handler for all logs
file_handler = logging.FileHandler(
    LOGS_DIR / f"app_{datetime.now().strftime('%Y%m%d')}.log"
)
file_handler.setLevel(logging.DEBUG)
file_handler.setFormatter(formatter)

# File handler for errors only
error_handler = logging.FileHandler(
    LOGS_DIR / f"errors_{datetime.now().strftime('%Y%m%d')}.log"
)
error_handler.setLevel(logging.ERROR)
error_handler.setFormatter(formatter)


def get_logger(name: str) -> logging.Logger:
    """
    Get a configured logger instance
    
    Args:
        name: Logger name (usually __name__ of the module)
    
    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)
    
    # Avoid adding handlers multiple times
    if not logger.handlers:
        logger.addHandler(console_handler)
        logger.addHandler(file_handler)
        logger.addHandler(error_handler)
    
    return logger


# Create a default logger for the application
app_logger = get_logger("hms")
