from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.emergency_service import EmergencyService
import logging

router = APIRouter()
emergency_service = EmergencyService()

class AppointmentRequest(BaseModel):
    hospital_id: int
    user_id: str
    user_name: str
    user_phone: str
    symptoms: str
    preferred_time: str

class AppointmentResponse(BaseModel):
    success: bool
    message: str
    appointment_id: str = None
    confirmation_code: str = None

@router.post("/book")
async def book_appointment(request: AppointmentRequest):
    try:
        user_info = {
            "user_id": request.user_id,
            "name": request.user_name,
            "phone": request.user_phone
        }
        
        result = emergency_service.book_appointment(
            hospital_id=request.hospital_id,
            user_info=user_info,
            preferred_time=request.preferred_time,
            symptoms=request.symptoms  # Pass symptoms for voice call
        )
        
        return AppointmentResponse(
            success=result["success"],
            message=result["message"],
            appointment_id=result.get("appointment_id"),
            confirmation_code=result.get("confirmation_code")
        )
        
    except Exception as e:
        logging.error(f"Appointment booking error: {str(e)}")
        raise HTTPException(status_code=500, detail="Appointment booking failed")

@router.get("/emergency-contacts")
async def get_emergency_contacts():
    try:
        contacts = emergency_service.get_emergency_contacts()
        return {"contacts": contacts}
    except Exception as e:
        logging.error(f"Get contacts error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch emergency contacts")