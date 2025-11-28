// ===================================================================
// LOCATION FIX - Replace triggerEmergency() function
// Find line ~488 in app.js with "async function triggerEmergency()"
// Replace ONLY that ONE function with this code below:
// ===================================================================

// Emergency function
async function triggerEmergency() {
    if (confirm('🚨 This will call emergency services. Are you in a life-threatening situation?')) {
        showLoading(true);

        // Get real browser location
        if (!navigator.geolocation) {
            addMessage('Location access needed for emergency services!', 'bot');
            showLoading(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(async (position) => {
            try {
                const location = `${position.coords.latitude}, ${position.coords.longitude}`;
                console.log(`🚨 Emergency at real location: ${location}`);

                const response = await fetch('http://localhost:8000/api/emergency/ambulance', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: 'user_123',
                        location: location,
                        symptoms: 'Emergency Alert',
                        contact_number: '555-0123',
                        patient_name: null,
                        incident_details: null
                    })
                });

                const data = await response.json();
                alert('Emergency services have been notified. Help is on the way!');
                addMessage(`🚨 EMERGENCY: ${data.message}`, 'bot');
            } catch (error) {
                console.error('Error:', error);
                addMessage('Failed to call emergency services. Please call 911 immediately!', 'bot');
            } finally {
                showLoading(false);
            }
        }, (error) => {
            console.error('Location error:', error);
            addMessage('Failed to get location. Please enable location access!', 'bot');
            showLoading(false);
        });
    }
}
