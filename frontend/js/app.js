// Global variables
let isVoiceMode = false;
let currentSessionId = 'session_' + Date.now();
let recognition = null;

// Initialize the app
document.addEventListener('DOMContentLoaded', function () {
    console.log('Nexus Health initialized');

    // Initialize voice recognition if available
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        initVoiceRecognition();
    } else {
        const voiceBtn = document.getElementById('voice-button');
        if (voiceBtn) {
            voiceBtn.disabled = true;
            voiceBtn.title = 'Voice not supported';
        }
    }

    // Attach event listeners
    document.getElementById('send-button').addEventListener('click', sendMessage);
    document.getElementById('message-input').addEventListener('keypress', handleKeyPress);
    document.getElementById('voice-button').addEventListener('click', toggleVoiceMode);

    // Chat File Upload Listeners
    const attachBtn = document.getElementById('attach-button');
    const fileInput = document.getElementById('chat-file-input');

    if (attachBtn && fileInput) {
        attachBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', handleFileUpload);
    }

    // Emergency Button (Floating)
    const emergencyBtn = document.getElementById('emergency-button');
    if (emergencyBtn) emergencyBtn.addEventListener('click', triggerEmergency);

    // New Action Icons
    const alertBtn = document.getElementById('alert-button');
    if (alertBtn) alertBtn.addEventListener('click', triggerEmergency);

    const hospitalBtn = document.getElementById('hospital-button');
    if (hospitalBtn) hospitalBtn.addEventListener('click', toggleHospitalMenu);

    // Close hospital menu when clicking outside
    document.addEventListener('click', function (event) {
        const menu = document.getElementById('hospital-menu');
        const btn = document.getElementById('hospital-button');
        if (menu && btn && !menu.contains(event.target) && !btn.contains(event.target)) {
            menu.style.display = 'none';
        }
    });
});

// Hospital Menu Functions
function toggleHospitalMenu() {
    const menu = document.getElementById('hospital-menu');
    if (menu) {
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    }
}

function handleHospitalAction(action) {
    const menu = document.getElementById('hospital-menu');
    if (menu) menu.style.display = 'none';

    if (action === 'locate') {
        findHospitals();
    }
}

// Voice Recognition Functions
function initVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = function () {
        console.log('Voice recognition started. Speak now.');
        const input = document.getElementById('message-input');
        input.placeholder = "Listening...";
    };

    recognition.onspeechend = function () {
        console.log('Speech ended.');
    };

    recognition.onresult = function (event) {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }

        const input = document.getElementById('message-input');
        if (interimTranscript) {
            input.value = interimTranscript;
        }
        if (finalTranscript) {
            input.value = finalTranscript;
            console.log('Final transcript:', finalTranscript);
            sendMessage();
        }
    };

    recognition.onend = function () {
        console.log('Voice recognition ended.');
        if (isVoiceMode) {
            setTimeout(() => {
                if (isVoiceMode) {
                    console.log('Restarting recognition...');
                    try {
                        recognition.start();
                    } catch (e) {
                        console.log('Recognition already active');
                    }
                }
            }, 300);
        } else {
            const voiceBtn = document.getElementById('voice-button');
            if (voiceBtn) voiceBtn.classList.remove('recording');
            document.getElementById('message-input').placeholder = "Describe symptoms or upload prescription...";
        }
    };

    recognition.onerror = function (event) {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
            alert('Microphone access denied. Please allow microphone access to use voice mode.');
            toggleVoiceMode();
        } else if (event.error === 'no-speech') {
            console.log('No speech detected.');
        }
    };
}

function toggleVoiceMode() {
    if (!recognition) {
        alert('Voice recognition not supported in your browser');
        return;
    }

    isVoiceMode = !isVoiceMode;
    const voiceBtn = document.getElementById('voice-button');
    const voiceIcon = document.getElementById('voice-icon');

    if (isVoiceMode) {
        voiceBtn.classList.add('recording');
        voiceIcon.className = 'fas fa-stop';
        startVoiceRecognition();
        speakText("Voice mode enabled. I am listening.");
    } else {
        voiceBtn.classList.remove('recording');
        voiceIcon.className = 'fas fa-microphone';
        stopVoiceRecognition();
        window.speechSynthesis.cancel();
    }
}

function startVoiceRecognition() {
    try {
        recognition.start();
    } catch (e) {
        console.error('Recognition already started');
    }
}

function stopVoiceRecognition() {
    try {
        recognition.stop();
    } catch (e) {
        console.error('Recognition already stopped');
    }
}

function speakText(text) {
    if (!isVoiceMode) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    window.speechSynthesis.speak(utterance);
}

// Handle file upload for prescription analysis
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Reset input
    event.target.value = '';

    // Add message to chat indicating upload
    addMessage(`📄 Uploaded prescription: ${file.name}`, 'user');
    showTypingIndicator();

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('http://localhost:8000/api/medical/analyze-prescription', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        removeTypingIndicator();

        // Render result in chat
        const analysisHtml = renderPrescriptionResult(data.analysis);
        addMessage(analysisHtml, 'bot');

        // Auto-set reminders
        if (data.analysis && data.analysis.medications) {
            const count = data.analysis.medications.length;
            addMessage(`✅ I've extracted ${count} medications and automatically set reminders for you.`, 'bot');

            if (isVoiceMode) {
                speakText(`I have analyzed your prescription and set reminders for ${count} medications.`);
            }

            // Set reminders automatically
            data.analysis.medications.forEach(med => {
                setReminder(med.name, med.frequency, true); // true = silent/auto mode
            });
        }

    } catch (error) {
        console.error('Error:', error);
        removeTypingIndicator();
        addMessage('Failed to analyze prescription. Please try again.', 'bot');
    }
}

function renderPrescriptionResult(analysis) {
    if (!analysis || !analysis.medications) {
        return '<p>Could not extract structured data.</p>';
    }

    let html = `
        <div class="card border-success mb-2">
            <div class="card-header bg-success text-white py-1 px-2">
                <small><i class="fas fa-file-prescription"></i> Prescription Analysis</small>
            </div>
            <div class="card-body p-2">
                <p class="mb-1 small"><strong>Dr:</strong> ${analysis.doctor_name} | <strong>Date:</strong> ${analysis.date}</p>
                <div class="table-responsive">
                    <table class="table table-sm table-striped mb-0 small">
                        <thead>
                            <tr>
                                <th>Medicine</th>
                                <th>Dosage</th>
                                <th>Freq</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
    `;

    analysis.medications.forEach(med => {
        html += `
            <tr>
                <td>${med.name}</td>
                <td>${med.dosage}</td>
                <td>${med.frequency}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary py-0" onclick="buyMedicine('${med.name}')">
                        Buy
                    </button>
                </td>
            </tr>
        `;
    });

    html += `
                        </tbody>
                    </table>
                </div>
                <p class="mt-1 mb-0 small text-muted"><em>${analysis.special_instructions || ''}</em></p>
            </div>
        </div>
    `;

    return html;
}

// Render medicine cards below AI response
function renderMedicineCards(medicines) {
    if (!medicines || medicines.length === 0) return;

    const chatMessages = document.getElementById('chat-messages');
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'medicine-cards-container mb-3';

    medicines.forEach(med => {
        const cardHtml = `
            <div class="medicine-card alert alert-success border-success d-flex justify-content-between align-items-center p-3 mb-2">
                <div class="medicine-info">
                    <h6 class="mb-1">💊 ${med.display_name}</h6>
                    <small class="text-muted">${med.estimated_price}</small>
                </div>
                <button class="btn btn-primary btn-sm" onclick="buyMedicine('${med.name}')">
                    <i class="fas fa-shopping-cart"></i> Buy Now
                </button>
            </div>
        `;
        cardsContainer.innerHTML += cardHtml;
    });

    chatMessages.appendChild(cardsContainer);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Send message to chat
async function sendMessage() {
    const input = document.getElementById('message-input');
    const message = input.value.trim();
    if (!message) return;

    // Add user message to chat
    addMessage(message, 'user');
    input.value = '';
    showTypingIndicator();

    try {
        const response = await fetch('http://localhost:8000/api/chat/text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: message,
                session_id: currentSessionId,
                user_id: "user_123"
            })
        });

        const data = await response.json();
        removeTypingIndicator();

        // Handle actions first
        let actionTriggered = false;
        if (data.action) {
            console.log("Action triggered:", data.action);
            actionTriggered = true;
            switch (data.action.type) {
                case 'EMERGENCY':
                    triggerEmergency();
                    break;
                case 'HOSPITAL_SEARCH':
                    findHospitals();
                    break;
                case 'BOOK_APPOINTMENT':
                    bookAppointment();
                    break;
                case 'ORDER_MEDICINE':
                    if (data.action.data) {
                        orderMedicine(data.action.data);
                    }
                    break;
            }
        }

        // Clean response text (remove [MED:...] markers)
        let cleanResponse = data.response ? data.response.replace(/\[MED:(.*?)\]/g, '$1') : '';

        // Only show AI text response if it's NOT just a generic confirmation of the action
        // OR if no action was triggered.
        if (!actionTriggered && cleanResponse) {
            // Await the streaming to finish before showing cards
            await addMessage(cleanResponse, 'bot', true);
            if (isVoiceMode) {
                speakText(cleanResponse);
            }
        } else if (actionTriggered && cleanResponse) {
            // Suppress AI response if action is triggered to avoid double printing
            console.log("Suppressed AI response due to action:", cleanResponse);
        }

        // Render medicine cards if recommendations found
        if (data.medicine_recommendations && data.medicine_recommendations.length > 0) {
            renderMedicineCards(data.medicine_recommendations);
        }

    } catch (error) {
        console.error('Error:', error);
        removeTypingIndicator();
        addMessage('Failed to get response. Please try again.', 'bot');
    }
}

function setReminder(medicineName, frequency, silent = false) {
    // Simulate setting a reminder
    const time = new Date();
    time.setSeconds(time.getSeconds() + 5);

    if (!silent) {
        alert(`Reminder set for ${medicineName} (${frequency}).`);
    }

    setTimeout(() => {
        // Play a sound
        const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
        audio.play().catch(e => console.log('Audio play failed', e));

        // Use a nicer notification if possible, fallback to alert
        if (Notification.permission === "granted") {
            new Notification(`⏰ Time to take ${medicineName}!`, {
                body: `Dosage: ${frequency}`
            });
        } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    new Notification(`⏰ Time to take ${medicineName}!`, {
                        body: `Dosage: ${frequency}`
                    });
                } else {
                    alert(`⏰ REMINDER: Time to take ${medicineName}!`);
                }
            });
        } else {
            alert(`⏰ REMINDER: Time to take ${medicineName}!`);
        }

        if (isVoiceMode) {
            speakText(`It is time to take your ${medicineName}.`);
        }
    }, 5000 + (Math.random() * 2000)); // Stagger slightly
}

// Add message to chat
function addMessage(text, sender, stream = false) {
    const chatMessages = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;

    // Create content wrapper
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    messageDiv.appendChild(contentDiv);

    // Create time element
    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.innerText = 'Just now';
    messageDiv.appendChild(timeDiv);

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    if (stream && sender === 'bot' && !text.trim().startsWith('<')) {
        // Stream text for bot messages that aren't HTML
        // Return the promise from typeMessage
        return typeMessage(text, contentDiv);
    } else {
        // Check if text is HTML (starts with <)
        if (text.trim().startsWith('<')) {
            contentDiv.innerHTML = text;
        } else {
            // Escape HTML for plain text to prevent XSS
            const safeText = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            contentDiv.innerHTML = safeText;
        }
        return Promise.resolve();
    }
}

// Format message with basic markdown
function formatMessage(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
}

// Typing effect function
function typeMessage(text, element) {
    return new Promise((resolve) => {
        const formatted = formatMessage(text);
        // Split by HTML tags or words
        // Regex matches: <tag...> OR non-tag text
        const parts = formatted.match(/(<[^>]+>|[^<]+)/g) || [];

        let i = 0;

        function stream() {
            if (i >= parts.length) {
                resolve();
                return;
            }

            const part = parts[i];
            if (part.startsWith('<')) {
                // It's a tag, append immediately
                element.innerHTML += part;
                i++;
                stream();
            } else {
                // It's text, split by space to get words
                // We preserve spaces by splitting by space and adding it back
                const words = part.split(' ');
                let w = 0;

                function streamWords() {
                    if (w >= words.length) {
                        i++;
                        stream();
                        return;
                    }
                    // Add space if it's not the last word, or if the original text had space
                    // Simple approximation: add space after every word except maybe last?
                    // split(' ') consumes the space.
                    element.innerHTML += words[w] + (w < words.length - 1 ? ' ' : '');
                    w++;

                    const chatMessages = document.getElementById('chat-messages');
                    chatMessages.scrollTop = chatMessages.scrollHeight;

                    // Fast delay for words (e.g., 30-70ms)
                    setTimeout(streamWords, 30 + Math.random() * 40);
                }
                streamWords();
            }
        }
        stream();
    });
}

// Show/Hide Typing Indicator
function showTypingIndicator() {
    const chatMessages = document.getElementById('chat-messages');

    // Remove existing if any
    removeTypingIndicator();

    const indicatorHtml = `
        <div id="typing-indicator" class="typing-indicator">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        </div>
    `;

    chatMessages.insertAdjacentHTML('beforeend', indicatorHtml);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.remove();
    }
}

// Handle Enter key press
function handleKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

function formatPrescriptionAnalysis(text) {
    if (!text) return '';
    if (typeof text === 'object') return JSON.stringify(text);
    return text.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

// Medicine functions
async function searchMedicines() {
    console.log("Medicine search triggered via AI or other means");
}

async function orderMedicine(medicineName = null) {
    if (!medicineName) return;

    if (confirm(`Do you want to place an order for ${medicineName}?`)) {
        showTypingIndicator();
        try {
            const response = await fetch(`http://localhost:8000/api/medical/order-medicine?medicine_id=1&user_id=user_123&quantity=1`, {
                method: 'POST'
            });
            const data = await response.json();
            removeTypingIndicator();
            addMessage(`Order placed successfully for ${medicineName}! Order ID: ${data.order_id}`, 'bot');
            alert(data.message);
        } catch (error) {
            console.error('Error:', error);
            removeTypingIndicator();
            addMessage('Failed to place order.', 'bot');
        }
    }
}

async function buyMedicine(medicineName) {
    console.log(`🛒 Buying medicine: ${medicineName}`);

    // Create a progress message container
    const progressId = 'progress-' + Date.now();
    const progressHtml = `
        <div id="${progressId}" class="alert alert-info mb-2">
            <div class="d-flex align-items-center">
                <div class="spinner-border spinner-border-sm me-2" role="status"></div>
                <span id="${progressId}-text">Initializing shopping agent...</span>
            </div>
        </div>
    `;
    addMessage(progressHtml, 'bot');

    // Simulated progress updates
    const updateProgress = (text) => {
        const el = document.getElementById(`${progressId}-text`);
        if (el) el.innerText = text;
    };

    // Sequence of updates
    setTimeout(() => updateProgress(`🔍 Searching for ${medicineName} on 1mg...`), 1000);
    setTimeout(() => updateProgress(`💊 Found ${medicineName}. Verifying details...`), 3000);
    setTimeout(() => updateProgress(`🛒 Adding ${medicineName} to cart...`), 5000);
    setTimeout(() => updateProgress(`✅ Verifying cart contents...`), 7000);

    try {
        const response = await fetch('http://localhost:8000/api/medical/buy-medicine', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                medicine_name: medicineName,
                user_id: 'user_123'
            })
        });

        const data = await response.json();

        // Remove progress message
        const progressEl = document.getElementById(progressId);
        if (progressEl) progressEl.remove();

        if (data.success) {
            const resultHtml = `
                <div class="alert alert-success">
                    <strong>✅ ${data.message}</strong><br>
                    <small>Price: ${data.price}</small><br>
                    <a href="${data.cart_url}" target="_blank" class="btn btn-sm btn-outline-success mt-2">
                        <i class="fas fa-external-link-alt"></i> View Cart
                    </a>
                </div>
            `;
            addMessage(resultHtml, 'bot');

            if (isVoiceMode) {
                speakText(data.message);
            }
        } else {
            addMessage(`❌ Failed to add medicine to cart: ${data.message}`, 'bot');
        }

    } catch (error) {
        console.error('Buy medicine error:', error);
        const progressEl = document.getElementById(progressId);
        if (progressEl) progressEl.remove();
        addMessage('❌ Failed to contact shopping agent. Please try again.', 'bot');
    }
}

// Hospital functions
async function findHospitals() {
    addMessage('Finding hospitals near your location...', 'user');
    showTypingIndicator();

    if (!navigator.geolocation) {
        removeTypingIndicator();
        addMessage('Geolocation is not supported by your browser.', 'bot');
        return;
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
        try {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;

            console.log(`Searching hospitals at: ${lat}, ${lon}`);

            const response = await fetch(`http://localhost:8000/api/emergency/hospitals/nearby?latitude=${lat}&longitude=${lon}`);
            const data = await response.json();
            removeTypingIndicator();

            if (data.length === 0) {
                addMessage('No hospitals found nearby.', 'bot');
            } else {
                let hospitalsHtml = '<div class="list-group">';
                data.forEach(hospital => {
                    hospitalsHtml += `
                        <div class="list-group-item list-group-item-action flex-column align-items-start border-0 shadow-sm mb-2 rounded">
                            <div class="d-flex w-100 justify-content-between">
                                <h6 class="mb-1 fw-bold text-primary">${hospital.name}</h6>
                                <small class="text-muted">${hospital.distance_km} km</small>
                            </div>
                            <p class="mb-1 small text-muted"><i class="fas fa-map-marker-alt me-1"></i> ${hospital.address}</p>
                            <button class="btn btn-sm btn-outline-primary mt-2 w-100" onclick="bookAppointment('${hospital.name.replace(/'/g, "\\'")}')">
                                <i class="fas fa-calendar-check me-1"></i> Book Appointment
                            </button>
                        </div>
                    `;
                });
                hospitalsHtml += '</div>';
                addMessage(hospitalsHtml, 'bot');

                if (isVoiceMode) {
                    speakText(`I found ${data.length} hospitals near you.`);
                }
            }

        } catch (error) {
            console.error('Error:', error);
            removeTypingIndicator();
            addMessage('Failed to find hospitals.', 'bot');
        }
    }, (error) => {
        console.error('Geolocation error:', error);
        removeTypingIndicator();
        addMessage('Unable to retrieve your location. Please allow location access.', 'bot');
    }, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
    });
}

async function bookAppointment(hospitalName = null) {
    let message = 'I want to book a doctor appointment';
    if (hospitalName) {
        message += ` at ${hospitalName}`;
    }
    addMessage(message, 'user');

    const time = prompt("Enter preferred time (e.g., Tomorrow 10 AM):");
    if (!time) return;

    showTypingIndicator();
    try {
        const response = await fetch('http://localhost:8000/api/appointments/book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                hospital_id: 1,
                user_id: 'user_123',
                user_name: 'John Doe',
                user_phone: '555-0123',
                symptoms: 'General checkup',
                preferred_time: time
            })
        });

        const data = await response.json();
        removeTypingIndicator();

        let confirmationMsg = `Appointment booked!`;
        if (hospitalName) {
            confirmationMsg += ` Your appointment at <strong>${hospitalName}</strong> is confirmed.`;
        } else {
            confirmationMsg += ` ${data.message}`;
        }
        addMessage(confirmationMsg, 'bot');

        if (isVoiceMode) {
            speakText(`Appointment booked successfully.`);
        }

    } catch (error) {
        console.error('Error:', error);
        removeTypingIndicator();
        addMessage('Failed to book appointment.', 'bot');
    }
}

// Emergency function
async function triggerEmergency() {
    if (confirm('🚨 This will call emergency services. Are you in a life-threatening situation?')) {
        showTypingIndicator();

        // Get real browser location
        if (!navigator.geolocation) {
            removeTypingIndicator();
            addMessage('Location access needed for emergency services!', 'bot');
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
                removeTypingIndicator();
                alert('Emergency services have been notified. Help is on the way!');
                addMessage(`🚨 EMERGENCY: ${data.message}`, 'bot');
            } catch (error) {
                console.error('Error:', error);
                removeTypingIndicator();
                addMessage('Failed to call emergency services. Please call 911 immediately!', 'bot');
            }
        }, (error) => {
            console.error('Location error:', error);
            removeTypingIndicator();
            addMessage('Failed to get location. Please enable location access!', 'bot');
        }, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        });
    }
}

// Update recommendations
function updateRecommendations(response) {
    const recommendationsDiv = document.getElementById('recommendations');
    recommendationsDiv.innerHTML = `<div class="alert alert-info">${formatPrescriptionAnalysis(response)}</div>`;
}

// Simple error handling
window.addEventListener('error', function (e) {
    console.error('Application error:', e.error);
    addMessage('Something went wrong. Please refresh the page and try again.', 'bot');
});