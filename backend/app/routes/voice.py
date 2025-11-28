from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from app.services.voice_service import VoiceService
import logging

router = APIRouter()
voice_service = VoiceService()

class VoiceResponse(BaseModel):
    text: str
    success: bool

@router.post("/speech-to-text")
async def convert_speech_to_text(audio_file: UploadFile = File(...)):
    try:
        # Read audio file
        audio_data = await audio_file.read()
        
        # Convert to text
        text = voice_service.speech_to_text(audio_data)
        
        return VoiceResponse(text=text, success=True)
        
    except Exception as e:
        logging.error(f"Speech to text error: {str(e)}")
        raise HTTPException(status_code=500, detail="Speech recognition failed")
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from app.services.voice_service import VoiceService
import logging

router = APIRouter()
voice_service = VoiceService()

class VoiceResponse(BaseModel):
    text: str
    success: bool

@router.post("/speech-to-text")
async def convert_speech_to_text(audio_file: UploadFile = File(...)):
    try:
        # Read audio file
        audio_data = await audio_file.read()
        
        # Convert to text
        text = voice_service.speech_to_text(audio_data)
        
        return VoiceResponse(text=text, success=True)
        
    except Exception as e:
        logging.error(f"Speech to text error: {str(e)}")
        raise HTTPException(status_code=500, detail="Speech recognition failed")

@router.get("/voices")
async def get_available_voices():
    try:
        voices = voice_service.get_available_voices()
        return {"voices": voices}
    except Exception as e:
        logging.error(f"Get voices error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch voices")

@router.post("/text-to-speech")
async def text_to_speech(text: str, voice_id: str = "Rachel"):
    try:
        audio_data = voice_service.text_to_speech(text, voice_id)
        if not audio_data:
            raise HTTPException(status_code=500, detail="TTS generation failed")
            
        return {"audio_data": audio_data}
    except Exception as e:
        logging.error(f"TTS error: {str(e)}")
        raise HTTPException(status_code=500, detail="TTS generation failed")