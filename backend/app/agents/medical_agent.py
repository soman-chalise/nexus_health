from typing import Dict, List
import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()

class MedicalCrew:
    def __init__(self):
        self.gemini_api_key = os.getenv("GEMINI_API_KEY")
        if self.gemini_api_key:
            genai.configure(api_key=self.gemini_api_key)
            self.model = genai.GenerativeModel('gemini-pro')
        else:
            self.model = None

    def analyze_symptoms(self, symptoms: str, user_info: Dict = None) -> Dict:
        """Analyze symptoms using Gemini directly instead of CrewAI"""
        
        if not self.model:
            return self._get_fallback_response(symptoms)
        
        try:
            prompt = f"""
            As a medical AI assistant, analyze these symptoms: {symptoms}
            
            User info: {user_info}
            
            Provide a structured response with:
            1. Possible conditions (non-diagnostic)
            2. Recommended over-the-counter medications
            3. Home care advice
            4. When to see a doctor
            5. Emergency red flags to watch for
            
            Format the response clearly for a healthcare application.
            """
            
            response = self.model.generate_content(prompt)
            
            return self._parse_gemini_response(response.text, symptoms)
            
        except Exception as e:
            print(f"Gemini analysis error: {str(e)}")
            return self._get_fallback_response(symptoms)
    
    def _parse_gemini_response(self, response_text: str, symptoms: str) -> Dict:
        """Parse Gemini response into structured data"""
        # Simple parsing - you can make this more sophisticated
        return {
            "analysis": response_text,
            "medications": [
                {"name": "Paracetamol", "dosage": "500mg", "purpose": "Pain and fever relief"},
                {"name": "Ibuprofen", "dosage": "200mg", "purpose": "Inflammation reduction"}
            ],
            "emergency_level": self._assess_emergency_level(symptoms),
            "recommendations": [
                "Rest and hydrate well",
                "Monitor your symptoms",
                "Consult healthcare professional if symptoms persist"
            ]
        }
    
    def _assess_emergency_level(self, symptoms: str) -> str:
        """Simple emergency level assessment"""
        symptoms_lower = symptoms.lower()
        emergency_keywords = ["chest pain", "difficulty breathing", "severe pain", "unconscious", "bleeding heavily"]
        urgent_keywords = ["high fever", "persistent vomiting", "severe headache"]
        
        if any(keyword in symptoms_lower for keyword in emergency_keywords):
            return "high"
        elif any(keyword in symptoms_lower for keyword in urgent_keywords):
            return "medium"
        else:
            return "low"
    
    def _get_fallback_response(self, symptoms: str) -> Dict:
        """Fallback response when Gemini is not available"""
        return {
            "analysis": f"Based on your symptoms '{symptoms}', I recommend consulting with a healthcare professional for accurate diagnosis. In the meantime, rest and stay hydrated.",
            "medications": [
                {"name": "Consult pharmacist", "dosage": "N/A", "purpose": "Professional advice"}
            ],
            "emergency_level": "low",
            "recommendations": [
                "Rest adequately",
                "Drink plenty of fluids", 
                "Monitor symptoms",
                "Seek professional medical advice"
            ]
        }