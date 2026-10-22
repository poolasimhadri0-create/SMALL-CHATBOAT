import os
import sys
import uvicorn

# Ensure the backend directory is in the Python search path
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.core.config import settings

if __name__ == "__main__":
    print(f"Starting Gemini Chatbot Backend on port {settings.PORT}...")
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
