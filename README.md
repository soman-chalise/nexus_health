# Nexus Health AI

Nexus Health AI is a comprehensive healthcare assistant platform designed to provide intelligent medical support through an AI-powered interface. This project features a backend built with FastAPI and a frontend designed primarily for testing and demonstrating the core functionalities.

## Features

### 1. AI Chat Interface
-   **Endpoint**: `/api/chat/text`
-   **Functionality**: Users can chat with the Nexus AI assistant to describe symptoms or ask health-related questions.
-   **Outcome**: The AI provides intelligent responses, advice, and symptom triage.

### 2. Prescription Analysis
-   **Endpoint**: `/api/medical/analyze-prescription`
-   **Functionality**: Users can upload an image of a medical prescription. The system analyzes the image to extract medication details.
-   **Outcome**: Returns structured data including medicine names, dosages, and frequencies. It also automatically sets reminders for the extracted medications.

### 3. Medicine Search
-   **Endpoint**: `/api/medical/medicines/search`
-   **Functionality**: Search for medicines by name.
-   **Outcome**: Displays a list of matching medicines with their descriptions and prices.

### 4. Order Medicine
-   **Endpoint**: `/api/medical/order-medicine`
-   **Functionality**: Place an order for a selected medicine.
-   **Outcome**: Returns an order confirmation with a unique Order ID.

### 5. Hospital Search
-   **Endpoint**: `/api/emergency/hospitals/nearby`
-   **Functionality**: Uses the user's real-time geolocation to find nearby hospitals.
-   **Outcome**: Lists hospitals sorted by distance, including their names and addresses.

### 6. Book Appointment
-   **Endpoint**: `/api/appointments/book`
-   **Functionality**: Book an appointment with a doctor at a specific hospital.
-   **Outcome**: Returns a confirmation message with appointment details.

### 7. Emergency Services
-   **Endpoint**: `/api/emergency/ambulance`
-   **Functionality**: Trigger an immediate emergency alert.
-   **Outcome**: Simulates contacting emergency services and sending an ambulance to the user's location.

### 8. Voice Mode
-   **Functionality**: Supports voice-to-text for input and text-to-speech for AI responses.
-   **Outcome**: Enables hands-free interaction with the platform.

## Frontend Overview

The frontend (located in `frontend/`) is a lightweight HTML/JavaScript interface designed **specifically to test and verify that the backend routes and services are working correctly**.

It provides a simple UI to:
-   Send chat messages.
-   Upload prescription files.
-   Trigger buttons for searching medicines, finding hospitals, and booking appointments.
-   Toggle voice interaction.

**Outcomes in Frontend:**
-   **Chat**: Displays the AI's text response.
-   **Prescription**: Shows a parsed table of medications and triggers browser alerts for reminders.
-   **Search/Listings**: Dynamically updates the "Recommendations" panel with search results or hospital lists.
-   **Actions**: Shows alert popups or chat messages confirming successful orders or bookings.

## Getting Started

### Backend
1.  Navigate to `backend/`.
2.  Install dependencies (ensure `requirements.txt` is present or install `fastapi`, `uvicorn`, `python-dotenv`, etc.).
3.  Run the backend server:
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
    The API will run at `http://0.0.0.0:8000`.

### Frontend
1.  Navigate to `frontend/`.
2.  Run the frontend server:
    python -m http.server 3000
3.  Ensure the backend is running to interact with the features.
