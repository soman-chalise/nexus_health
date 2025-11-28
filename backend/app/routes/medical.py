from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from app.agents.medical_agent import MedicalCrew
from app.services.gemini_service import GeminiService
import logging
import json
import re

router = APIRouter()
medical_crew = MedicalCrew()
gemini_service = GeminiService()

class SymptomAnalysisRequest(BaseModel):
    symptoms: str
    user_id: str
    age: int = None
    gender: str = None
    existing_conditions: list = []

class SymptomAnalysisResponse(BaseModel):
    analysis: str
    medications: list
    emergency_level: str
    recommendations: list
    should_see_doctor: bool

@router.post("/analyze-symptoms")
async def analyze_symptoms(request: SymptomAnalysisRequest):
    try:
        user_info = {
            "age": request.age,
            "gender": request.gender,
            "existing_conditions": request.existing_conditions
        }
        
        result = medical_crew.analyze_symptoms(
            symptoms=request.symptoms,
            user_info=user_info
        )
        
        return SymptomAnalysisResponse(
            analysis=result["analysis"],
            medications=result["medications"],
            emergency_level=result["emergency_level"],
            recommendations=result["recommendations"],
            should_see_doctor=result["emergency_level"] in ["high", "medium"]
        )
        
    except Exception as e:
        logging.error(f"Symptom analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze-prescription")
async def analyze_prescription(file: UploadFile = File(...)):
    try:
        # Read file content
        content = await file.read()
        
        # Analyze with Gemini
        prompt = """
        Analyze this prescription image and extract the following details in strict JSON format:
        {
            "doctor_name": "Name of the doctor",
            "patient_name": "Name of the patient (if visible)",
            "date": "Date of prescription",
            "medications": [
                {
                    "name": "Medicine Name",
                    "dosage": "Dosage (e.g., 500mg)",
                    "frequency": "Frequency (e.g., twice daily, after food)",
                    "duration": "Duration (e.g., 5 days)"
                }
            ],
            "special_instructions": "Any special notes"
        }
        If a field is not visible, use "Not specified".
        Ensure the output is valid JSON. Do not include markdown formatting like ```json.
        """
        
        analysis_text = gemini_service.analyze_image(content, prompt)
        
        # Clean up response if it contains markdown code blocks
        clean_text = analysis_text.strip()
        if clean_text.startswith("```json"):
            clean_text = clean_text[7:]
        if clean_text.endswith("```"):
            clean_text = clean_text[:-3]
            
        try:
            analysis_json = json.loads(clean_text)
        except json.JSONDecodeError:
            # Fallback if JSON parsing fails
            logging.error(f"Failed to parse JSON from Gemini: {analysis_text}")
            analysis_json = {
                "doctor_name": "Unknown",
                "date": "Unknown",
                "medications": [],
                "special_instructions": analysis_text
            }
            
        return {"analysis": analysis_json}
        
    except Exception as e:
        logging.error(f"Prescription analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to analyze prescription")

@router.get("/medicines/search")
async def search_medicines(query: str):
    try:
        mock_medicines = [
            {
                "id": 1,
                "name": "Paracetamol 500mg",
                "category": "Pain Relief",
                "description": "For headaches, fever, and mild pain",
                "price": 5.99,
                "in_stock": True
            },
            {
                "id": 2,
                "name": "Ibuprofen 200mg",
                "category": "Pain Relief",
                "description": "For inflammation and pain relief",
                "price": 7.99,
                "in_stock": True
            },
            {
                "id": 3,
                "name": "Cetirizine 10mg",
                "category": "Allergy",
                "description": "For allergy relief and hay fever",
                "price": 12.99,
                "in_stock": True
            },
            {
                "id": 4,
                "name": "Amoxicillin 500mg",
                "category": "Antibiotic",
                "description": "For bacterial infections",
                "price": 15.50,
                "in_stock": True
            }
        ]
        
        # Filter by query
        filtered_medicines = [
            med for med in mock_medicines 
            if query.lower() in med["name"].lower() or query.lower() in med["category"].lower()
        ]
        
        return {"medicines": filtered_medicines}
        
    except Exception as e:
        logging.error(f"Medicine search error: {str(e)}")
        raise HTTPException(status_code=500, detail="Medicine search failed")

@router.post("/order-medicine")
async def order_medicine(medicine_id: int, user_id: str, quantity: int = 1):
    try:
        # Mock order processing
        order_id = f"ORD_{user_id}_{medicine_id}_{quantity}"
        
        return {
            "success": True,
            "order_id": order_id,
            "message": f"Medicine order placed successfully. Order ID: {order_id}",
            "estimated_delivery": "2-3 business days"
        }
        
    except Exception as e:
        logging.error(f"Medicine order error: {str(e)}")
        raise HTTPException(status_code=500, detail="Medicine ordering failed")

class BuyMedicineRequest(BaseModel):
    medicine_name: str
    user_id: str

@router.post("/buy-medicine")
async def buy_medicine(request: BuyMedicineRequest):
    """
    AI Agent endpoint: Autonomously search and add medicine to cart on PharmEasy
    """
    try:
        from app.agents.shopping_agent import get_shopping_agent
        
        logging.info(f"🤖 AI Shopping Agent activated for user {request.user_id}: {request.medicine_name}")
        
        # Get shopping agent singleton
        agent = get_shopping_agent()
        
        # Execute autonomous shopping task in background (headless mode)
        result = agent.search_and_add_to_cart(
            medicine_name=request.medicine_name,
            headless=True  # Run invisibly in background
        )
        
        if result["success"]:
            logging.info(f"✅ Successfully added {request.medicine_name} to cart")
            return {
                "success": True,
                "medicine_name": result["medicine_name"],
                "cart_url": result["cart_url"],
                "price": result.get("price", "N/A"),
                "message": f"✅ I've added {request.medicine_name} to your cart! Click the link to view.",
                "agent_used": True
            }
        else:
            logging.error(f"❌ Shopping agent failed: {result['message']}")
            return {
                "success": False,
                "message": result["message"],
                "medicine_name": request.medicine_name,
                "cart_url": None
            }
        
    except Exception as e:
        logging.error(f"Buy medicine error: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Shopping agent failed: {str(e)}"
        )