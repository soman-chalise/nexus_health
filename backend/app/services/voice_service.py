import os
import logging
from typing import Optional
import base64
from fastapi import HTTPException
import requests
from dotenv import load_dotenv

load_dotenv()

class VoiceService:
    def __init__(self):
        self.elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY")
        self.use_elevenlabs = bool(self.elevenlabs_api_key)
        
        # Fallback to system TTS if ElevenLabs not available
        if not self.use_elevenlabs:
            logging.warning("ElevenLabs API key not found. Using system TTS fallback.")
        
    def text_to_speech(self, text: str, voice_id: str = "Rachel") -> Optional[str]:
        """
        Convert text to speech using ElevenLabs API or system fallback
        Returns base64 encoded audio or file path
        """
        try:
            if self.use_elevenlabs:
                return self._elevenlabs_tts(text, voice_id)
            else:
                return self._system_tts(text)
        except Exception as e:
            logging.error(f"TTS conversion failed: {str(e)}")
            return None
    
    def _elevenlabs_tts(self, text: str, voice_id: str) -> str:
        """Convert text to speech using ElevenLabs API"""
        try:
            url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
            
            headers = {
                "Accept": "audio/mpeg",
                "Content-Type": "application/json",
                "xi-api-key": self.elevenlabs_api_key
            }
            
            data = {
                "text": text,
                "model_id": "eleven_monolingual_v1",
                "voice_settings": {
                    "stability": 0.5,
                    "similarity_boost": 0.5
                }
            }
            
            response = requests.post(url, json=data, headers=headers)
            response.raise_for_status()
            
            # Convert audio to base64 for easy frontend handling
            audio_base64 = base64.b64encode(response.content).decode('utf-8')
            return f"data:audio/mpeg;base64,{audio_base64}"
            
        except Exception as e:
            logging.error(f"ElevenLabs TTS error: {str(e)}")
            raise HTTPException(status_code=500, detail="Voice synthesis failed")
    
    def _system_tts(self, text: str) -> str:
        """Fallback using system text-to-speech"""
        try:
            # For Windows
            try:
                import win32com.client
                speaker = win32com.client.Dispatch("SAPI.SpVoice")
                # This would save to file in real implementation
                logging.info(f"System TTS (Windows): {text}")
                return "system://tts"  # Placeholder
            except ImportError:
                pass
            
            # For macOS
            try:
                import os
                os.system(f'say "{text}"')
                return "system://tts"  # Placeholder
            except:
                pass
            
            # For Linux (espeak)
            try:
                import os
                os.system(f'espeak "{text}"')
                return "system://tts"  # Placeholder
            except:
                pass
            
            logging.warning("No TTS system available")
            return None
            
        except Exception as e:
            logging.error(f"System TTS error: {str(e)}")
            return None
    
    def speech_to_text(self, audio_data: bytes) -> str:
        """
        Convert speech to text using Google Speech Recognition
        """
        try:
            import speech_recognition as sr
            
            recognizer = sr.Recognizer()
            
            # Save audio data to temporary file
            with open("temp_audio.wav", "wb") as f:
                f.write(audio_data)
            
            # Use audio file for recognition
            with sr.AudioFile("temp_audio.wav") as source:
                audio = recognizer.record(source)
                
            text = recognizer.recognize_google(audio)
            
            # Clean up
            if os.path.exists("temp_audio.wav"):
                os.remove("temp_audio.wav")
                
            return text
            
        except Exception as e:
            logging.error(f"Speech to text error: {str(e)}")
            raise HTTPException(status_code=500, detail="Speech recognition failed")

    def get_available_voices(self) -> list:
        """Get list of available voices"""
        if not self.use_elevenlabs:
            return [{"id": "system", "name": "System Default"}]
        
        try:
            url = "https://api.elevenlabs.io/v1/voices"
            headers = {"xi-api-key": self.elevenlabs_api_key}
            
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            
            voices_data = response.json()
            return voices_data.get("voices", [])
            
        except Exception as e:
            logging.error(f"Error fetching voices: {str(e)}")
            return []