import os
import logging
from typing import Dict, List, Optional
from geopy.geocoders import Nominatim
from geopy.distance import geodesic
import requests
from twilio.rest import Client
from twilio.twiml.voice_response import VoiceResponse
from dotenv import load_dotenv

load_dotenv()

class EmergencyService:
    def __init__(self):
        self.twilio_account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        self.twilio_auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        self.twilio_phone_number = os.getenv("TWILIO_PHONE_NUMBER")
        self.google_maps_api_key = os.getenv("GOOGLE_MAPS_API_KEY")
        
        self.twilio_client = None
        if self.twilio_account_sid and self.twilio_auth_token:
            self.twilio_client = Client(self.twilio_account_sid, self.twilio_auth_token)
        
        self.geolocator = Nominatim(user_agent="nexus_health")
        
        self.mock_hospitals = [
            {"id": 1, "name": "City General Hospital", "address": "123 Main Street, Cityville", "phone": "+1-555-0101", "latitude": 40.7128, "longitude": -74.0060, "emergency_services": True, "distance": None},
            {"id": 2, "name": "Community Medical Center", "address": "456 Oak Avenue, Townsville", "phone": "+1-555-0102", "latitude": 40.7589, "longitude": -73.9851, "emergency_services": True, "distance": None},
            {"id": 3, "name": "QuickCare Clinic", "address": "789 Pine Road, Villagetown", "phone": "+1-555-0103", "latitude": 40.7505, "longitude": -73.9934, "emergency_services": False, "distance": None}
        ]
    
    def find_nearby_hospitals(self, latitude: float, longitude: float, radius: int = 5000) -> List[Dict]:
        """Find nearby hospitals using OpenStreetMap"""
        try:
            delta = 0.05
            viewbox = [longitude - delta, latitude - delta, longitude + delta, latitude + delta]
            url = "https://nominatim.openstreetmap.org/search"
            params = {"q": "hospital", "format": "json", "limit": 10, "viewbox": f"{viewbox[0]},{viewbox[1]},{viewbox[2]},{viewbox[3]}", "bounded": 1, "addressdetails": 1}
            headers = {"User-Agent": "NexusHealth/1.0"}
            response = requests.get(url, params=params, headers=headers)
            results = response.json()
            
            hospitals = []
            for result in results:
                hospital_lat, hospital_lon = float(result["lat"]), float(result["lon"])
                distance = geodesic((latitude, longitude), (hospital_lat, hospital_lon)).km
                hospitals.append({"id": result.get("place_id"), "name": result.get("name", "Unknown Hospital"), "address": result.get("display_name"), "latitude": hospital_lat, "longitude": hospital_lon, "distance_km": round(distance, 2), "phone": "N/A"})
            
            hospitals.sort(key=lambda x: x["distance_km"])
            return hospitals
        except Exception as e:
            logging.error(f"Error finding hospitals: {str(e)}")
            return self._get_mock_hospitals_with_distance(latitude, longitude)

    def _get_mock_hospitals_with_distance(self, lat: float, lon: float) -> List[Dict]:
        hospitals = []
        for h in self.mock_hospitals:
            dist = geodesic((lat, lon), (h["latitude"], h["longitude"])).km
            h_copy = h.copy()
            h_copy["distance_km"] = round(dist, 2)
            hospitals.append(h_copy)
        hospitals.sort(key=lambda x: x["distance_km"])
        return hospitals
    
    def request_ambulance(self, user_id: str, location: str, symptoms: str, contact_number: str, patient_name: str = None, incident_details: str = None) -> Dict:
        """Request ambulance service with patient details"""
        try:
            location_coords = self._geocode_address(location)
            if not location_coords:
                location_coords = {"latitude": 40.7128, "longitude": -74.0060, "address": location}
            
            nearest_hospital = self._find_nearest_emergency_center(location_coords["latitude"], location_coords["longitude"])
            ambulance_id = f"AMB_{user_id}_{len(symptoms)}"
            verified_phone = os.getenv("USER_PHONE_NUMBER", "+917710091354")
            
            if self.twilio_client and verified_phone:
                self._send_emergency_notification(verified_phone, location_coords["address"], symptoms, ambulance_id, patient_name, incident_details)
            
            return {"success": True, "message": f"Ambulance dispatched! ETA: 8-12 mins. ID: {ambulance_id}", "ambulance_id": ambulance_id, "nearest_hospital": nearest_hospital["name"], "hospital_address": nearest_hospital["address"], "hospital_phone": nearest_hospital["phone"], "emergency_phone": verified_phone}
        except Exception as e:
            logging.error(f"Request ambulance error: {str(e)}")
            return {"success": False, "message": f"Emergency service error: {str(e)}"}
    
    def book_appointment(self, user_info: Dict, hospital_id: int, preferred_time: str, symptoms: str = "General consultation") -> Dict:
        """Book appointment and notify hospital via voice call"""
        try:
            hospital = next((h for h in self.mock_hospitals if h["id"] == hospital_id), None)
            if not hospital:
                return {"success": False, "message": "Hospital not found"}
            
            appointment_id = f"APT_{user_info.get('user_id', 'unknown')}_{hospital_id}"
            user_phone = os.getenv("USER_PHONE_NUMBER", "N/A")
            patient_name = user_info.get("name", "Unknown Patient")
            
            # Call hospital to notify (demo: calls user's phone)
            if self.twilio_client and user_phone:
                self._send_appointment_notification(user_phone, hospital["name"], patient_name, symptoms, preferred_time, appointment_id)
            
            return {"success": True, "message": f"Appointment booked at {hospital['name']}", "appointment_id": appointment_id, "hospital_name": hospital["name"], "hospital_address": hospital["address"], "hospital_phone": hospital["phone"], "scheduled_time": preferred_time, "confirmation_code": f"NXS{appointment_id[-6:]}", "user_phone": user_phone}
        except Exception as e:
            logging.error(f"Appointment booking error: {str(e)}")
            return {"success": False, "message": "Appointment booking failed"}
    
    def _geocode_address(self, address: str) -> Optional[Dict]:
        try:
            if ',' in address:
                try:
                    parts = address.split(',')
                    if len(parts) == 2:
                        lat, lon = float(parts[0].strip()), float(parts[1].strip())
                        location = self.geolocator.reverse(f"{lat}, {lon}", timeout=5)
                        if location:
                            return {"latitude": lat, "longitude": lon, "address": location.address}
                except (ValueError, AttributeError):
                    pass
            location = self.geolocator.geocode(address, timeout=5)
            if location:
                return {"latitude": location.latitude, "longitude": location.longitude, "address": location.address}
            return None
        except Exception as e:
            logging.error(f"Geocoding error: {str(e)}")
            return None
    
    def _find_nearest_emergency_center(self, latitude: float, longitude: float) -> Dict:
        try:
            emergency_hospitals = [h for h in self.mock_hospitals if h["emergency_services"]]
            if not emergency_hospitals:
                return self.mock_hospitals[0]
            nearest = min(emergency_hospitals, key=lambda h: geodesic((latitude, longitude), (h["latitude"], h["longitude"])).meters)
            return nearest
        except Exception as e:
            logging.error(f"Find nearest emergency center error: {str(e)}")
            return self.mock_hospitals[0]
    
    def _send_emergency_notification(self, contact_number: str, location: str, symptoms: str, ambulance_id: str, patient_name: str = None, incident_details: str = None):
        """Emergency voice call with natural Polly voice"""
        try:
            sms_body = f"🚨 NEXUS HEALTH EMERGENCY\nLocation: {location}\nSymptoms: {symptoms}\nAmbulance ID: {ambulance_id}"
            self.twilio_client.messages.create(body=sms_body, from_=self.twilio_phone_number, to=contact_number)
            
            if patient_name and incident_details:
                call_message = f"Hello, this is Nexus Health AI Emergency Response System. We have an urgent medical emergency requiring ambulance dispatch. Location: {location}. Patient name: {patient_name}. Incident: {incident_details}. Ambulance tracking ID: {ambulance_id}. Estimated arrival: 8 to 12 minutes. Please prepare to receive the patient. Thank you."
            else:
                call_message = f"Hello, this is Nexus Health AI Emergency Response System. We have an urgent medical emergency requiring ambulance dispatch at {location}. Patient condition: {symptoms}. Ambulance tracking ID: {ambulance_id}. Estimated arrival time: 8 to 12 minutes. Please prepare emergency staff. Thank you."
            
            response = VoiceResponse()
            response.say(call_message, voice="Polly.Joanna-Neural", language="en-US")
            call = self.twilio_client.calls.create(to=contact_number, from_=self.twilio_phone_number, twiml=str(response))
            logging.info(f"✅ Emergency call sent. SID: {call.sid}")
        except Exception as e:
            logging.error(f"Emergency notification error: {str(e)}")
    
    def _send_appointment_notification(self, contact_number: str, hospital_name: str, patient_name: str, symptoms: str, preferred_time: str, appointment_id: str):
        """Appointment booking voice call with natural Polly voice"""
        try:
            call_message = f"Hello, this is Nexus Health Emergency Service. This is an automated call regarding booking an appointment. Patient name: {patient_name}. Reason for visit: {symptoms}. Preferred time: {preferred_time}. Hospital: {hospital_name}. Appointment confirmation ID: {appointment_id}. Thank you."
            
            response = VoiceResponse()
            response.say(call_message, voice="Polly.Joanna-Neural", language="en-US")
            call = self.twilio_client.calls.create(to=contact_number, from_=self.twilio_phone_number, twiml=str(response))
            logging.info(f"✅ Appointment notification sent. SID: {call.sid}")
        except Exception as e:
            logging.error(f"Appointment notification error: {str(e)}")
    
    def get_emergency_contacts(self) -> List[Dict]:
        return [
            {"name": "Local Emergency", "number": "911", "type": "emergency"},
            {"name": "Poison Control", "number": "1-800-222-1222", "type": "specialized"},
            {"name": "Mental Health Crisis", "number": "988", "type": "crisis"},
            {"name": "Suicide Prevention", "number": "1-800-273-8255", "type": "crisis"}
        ]