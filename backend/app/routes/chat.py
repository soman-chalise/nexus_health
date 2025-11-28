from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.gemini_service import GeminiService
from app.services.voice_service import VoiceService
import logging

router = APIRouter()
gemini_service = GeminiService()
voice_service = VoiceService()

logger = logging.getLogger(__name__)

class ChatRequest(BaseModel):
    message: str
    user_id: str
    session_id: str = None
    is_voice: bool = False

class ChatResponse(BaseModel):
    response: str
    session_id: str
    is_voice: bool = False
    audio_url: str = None
    medicine_recommendations: list = []
    action: dict = None

@router.post("/text")
async def chat_text(request: ChatRequest):
    try:
        response = gemini_service.generate_response(
            message=request.message,
            user_id=request.user_id,
            session_id=request.session_id
        )
        
        # Extract medicine recommendations from response
        medicines = gemini_service.extract_medicines(response["text"])
        
        # Extract actions from response
        action = gemini_service.extract_actions(response["text"])
        
        return ChatResponse(
            response=response["text"],
            session_id=response["session_id"],
            is_voice=False,
            medicine_recommendations=medicines,
            action=action
        )
    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        raise HTTPException(status_code=500, detail="Chat processing failed")

@router.post("/voice")
async def chat_voice(request: ChatRequest):
    try:
        # Process text through Gemini
        text_response = gemini_service.generate_response(
            message=request.message,
            user_id=request.user_id,
            session_id=request.session_id
        )
        
        # Convert response to speech
        audio_url = voice_service.text_to_speech(text_response["text"])
        
        return ChatResponse(
            response=text_response["text"],
            session_id=text_response["session_id"],
            is_voice=True,
            audio_url=audio_url
        )
    except Exception as e:
        logger.error(f"Voice chat error: {str(e)}")
        raise HTTPException(status_code=500, detail="Voice processing failed")