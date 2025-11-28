from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.services.emergency_service import EmergencyService
import logging

router = APIRouter()
emergency_service = EmergencyService()

class EmergencyRequest(BaseModel):
    user_id: str
    location: str
    symptoms: str
    contact_number: str
    patient_name: Optional[str] = None  # Patient's name for personalized message
    incident_details: Optional[str] = None  # Additional context from chat history

class EmergencyResponse(BaseModel):
    success: bool
    message: str
    ambulance_id: Optional[str] = None

@router.post("/ambulance")
async def call_ambulance(request: EmergencyRequest):
    try:
        result = emergency_service.request_ambulance(
            user_id=request.user_id,
            location=request.location,
            symptoms=request.symptoms,
            contact_number=request.contact_number,
            patient_name=request.patient_name,
            incident_details=request.incident_details
        )
        
        return result  # Return the full result dict
    except Exception as e:
        logging.error(f"Emergency call error: {str(e)}")
        raise HTTPException(status_code=500, detail="Emergency service unavailable")

@router.get("/hospitals/nearby")
async def find_nearby_hospitals(latitude: float, longitude: float, radius: int = 5000):
    try:
        hospitals = emergency_service.find_nearby_hospitals(
            latitude=latitude,
            longitude=longitude,
            radius=radius
        )
        return hospitals
    except Exception as e:
        logging.error(f"Hospital search error: {str(e)}")
        raise HTTPException(status_code=500, detail="Hospital search failed")