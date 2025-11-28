from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
import os

from app.routes import chat, medical, emergency, appointments, voice  # Added voice

load_dotenv()

app = FastAPI(
    title="Nexus Health API",
    description="AI-powered healthcare assistant",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(medical.router, prefix="/api/medical", tags=["medical"])
app.include_router(emergency.router, prefix="/api/emergency", tags=["emergency"])
app.include_router(appointments.router, prefix="/api/appointments", tags=["appointments"])
app.include_router(voice.router, prefix="/api/voice", tags=["voice"])  # Added this line

@app.get("/")
async def root():
    return {"message": "Welcome to Nexus Health API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)