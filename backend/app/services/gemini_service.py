import google.generativeai as genai
import os
from dotenv import load_dotenv
import logging
from typing import Dict, List
import re

load_dotenv()

class GeminiService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY not found in environment variables")
        
        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel('gemini-2.0-flash')
        self.sessions = {}  # In production, use Redis or database
        
        # Medical context prompt
        self.medical_prompt = """
        You are Nexus Health AI, a medical assistant. Your role is to:
        1. Listen to symptoms and provide general health advice
        2. Suggest possible remedies and over-the-counter medications
        3. Recommend when to see a doctor
        4. NEVER prescribe prescription medications
        5. Always recommend consulting healthcare professionals for serious symptoms
        
        IMPORTANT: When recommending medicines, format them like this:
        "I recommend [MED:Paracetamol 500mg] for headache relief."
        
        Use [MED:medicine_name dosage] format for any medicine recommendation.
        This helps the system create quick-buy options for the user.

        IMPORTANT: If the user asks to perform a specific action, include the corresponding action tag in your response:
        - Call ambulance/emergency: [ACTION:EMERGENCY]
        - Find hospitals: [ACTION:HOSPITAL_SEARCH]
        - Book appointment: [ACTION:BOOK_APPOINTMENT]
        - Buy/Order medicine: [ACTION:ORDER_MEDICINE:medicine_name] (e.g., [ACTION:ORDER_MEDICINE:Paracetamol])
        
        Important disclaimers:
        - This is not a substitute for professional medical advice
        - For emergencies, call emergency services immediately
        - Always consult with healthcare providers for accurate diagnosis
        """
        
    def generate_response(self, message: str, user_id: str, session_id: str = None) -> Dict:
        try:
            if session_id not in self.sessions:
                self.sessions[session_id] = [{"role": "user", "parts": [self.medical_prompt]}]
            
            # Add user message to history
            self.sessions[session_id].append({"role": "user", "parts": [message]})
            
            # Generate response
            response = self.model.generate_content(self.sessions[session_id])
            
            # Add assistant response to history
            self.sessions[session_id].append({"role": "model", "parts": [response.text]})
            
            return {
                "text": response.text,
                "session_id": session_id
            }
            
        except Exception as e:
            logging.error(f"Gemini API error: {str(e)}")
            return {
                "text": "I apologize, but I'm having trouble processing your request. Please try again.",
                "session_id": session_id
            }

    def analyze_image(self, image_data: bytes, prompt: str) -> str:
        try:
            image_parts = [
                {
                    "mime_type": "image/jpeg",
                    "data": image_data
                }
            ]
            
            response = self.model.generate_content([prompt, image_parts[0]])
            return response.text
            
        except Exception as e:
            logging.error(f"Gemini Image API error: {str(e)}")
            raise e
    
    def extract_medicines(self, text: str) -> List[Dict]:
        """
        Extract medicine recommendations from AI response
        Format: [MED:Medicine Name Dosage]
        Returns: List of {name, display_name} dicts
        """
        # Find all [MED:...] patterns
        pattern = r'\[MED:(.*?)\]'
        matches = re.findall(pattern, text)
        
        medicines = []
        for match in matches:
            medicine_name = match.strip()
            medicines.append({
                "name": medicine_name,
                "display_name": medicine_name,
                "estimated_price": "₹50-200"  # Placeholder
            })
        
        return medicines

    def extract_actions(self, text: str) -> Dict:
        """
        Extract action tags from AI response
        Format: [ACTION:TYPE:DATA] or [ACTION:TYPE]
        Returns: {type, data} or None
        """
        pattern = r'\[ACTION:(.*?)\]'
        match = re.search(pattern, text)
        
        if match:
            content = match.group(1).split(':')
            action_type = content[0]
            action_data = content[1] if len(content) > 1 else None
            return {"type": action_type, "data": action_data}
        
        return None