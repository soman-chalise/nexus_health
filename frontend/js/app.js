// Configuration
const API_BASE_URL = 'http://localhost:8000';

// Initialize global variables
var isVoiceMode = false;
var currentSessionId = 'session_' + Date.now();
var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
var recognition;

// Chat History Management
const CHAT_HISTORY_KEY = 'nexus_health_chat_history';
const CURRENT_CHAT_KEY = 'nexus_health_current_chat';

// Get all chat history from localStorage
function getChatHistory() {
    const history = localStorage.getItem(CHAT_HISTORY_KEY);
    return history ? JSON.parse(history) : [];
}

// Save chat history to localStorage
function saveChatHistory(history) {
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(history));
}

// Get current chat ID
function getCurrentChatId() {
    return localStorage.getItem(CURRENT_CHAT_KEY) || currentSessionId;
}

// Set current chat ID
function setCurrentChatId(chatId) {
    localStorage.setItem(CURRENT_CHAT_KEY, chatId);
    currentSessionId = chatId;
}

// Save message to current conversation
function saveMessageToHistory(message, sender) {
    const history = getChatHistory();
    const chatId = getCurrentChatId();

    let chat = history.find(c => c.id === chatId);
    if (!chat) {
        chat = {
            id: chatId,
            title: message.substring(0, 30) + (message.length > 30 ? '...' : ''),
            messages: [],
            timestamp: Date.now()
        };
        history.unshift(chat);
    }

    chat.messages.push({
        text: message,
        sender: sender,
        timestamp: Date.now()
    });

    chat.lastUpdated = Date.now();
    saveChatHistory(history);
    updateSidebarUI();
}

// Load conversation by ID
function loadConversation(chatId) {
    const history = getChatHistory();
    const chat = history.find(c => c.id === chatId);

    if (!chat) return;

    setCurrentChatId(chatId);

    // Clear chat messages
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.innerHTML = '';

    // Load messages
    chat.messages.forEach(msg => {
        addMessageToUI(msg.text, msg.sender);
    });

    updateSidebarUI();
    closeSidebar();
}

// Create new conversation
function createNewConversation() {
    currentSessionId = 'session_' + Date.now();
    setCurrentChatId(currentSessionId);

    // Clear chat messages
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.innerHTML = '';

    // Add welcome message
    addMessageToUI('Hello! I\'m your medical assistant. How are you feeling today?', 'bot');

    updateSidebarUI();
    closeSidebar();
}

// Delete conversation
function deleteConversation(chatId, event) {
    if (event) {
        event.stopPropagation();
    }

    if (!confirm('Are you sure you want to delete this conversation?')) {
        return;
    }

    const history = getChatHistory();
    const filteredHistory = history.filter(c => c.id !== chatId);
    saveChatHistory(filteredHistory);

    // If deleted current chat, create new one
    if (chatId === getCurrentChatId()) {
        createNewConversation();
    }

    updateSidebarUI();
}

// Update sidebar UI
function updateSidebarUI() {
    const history = getChatHistory();
    const currentChatId = getCurrentChatId();
    const sidebarBody = document.getElementById('sidebar-body');

    if (!sidebarBody) return;

    let html = `
        <button class="btn btn-light w-100 mb-3" onclick="createNewConversation()">
            <i class="fas fa-plus me-2"></i> New Chat
        </button>
    `;

    if (history.length === 0) {
        // Show current session
        html += `
            <div class="conversation-item active">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <h6>Current Session</h6>
                        <small>Just now</small>
                    </div>
                </div>
            </div>
        `;
    } else {
        history.forEach(chat => {
            const isActive = chat.id === currentChatId;
            const timeAgo = getTimeAgo(chat.lastUpdated || chat.timestamp);

            html += `
                <div class="conversation-item ${isActive ? 'active' : ''}" onclick="loadConversation('${chat.id}')">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <h6>${chat.title}</h6>
                            <small>${timeAgo}</small>
                        </div>
                        <button class="btn btn-link p-0 delete-btn" onclick="deleteConversation('${chat.id}', event)">
                            <i class="fas fa-trash-alt fa-xs"></i>
                        </button>
                    </div>
                </div>
            `;
        });
    }

    sidebarBody.innerHTML = html;
}

// Get time ago
function getTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + ' min ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + ' hours ago';
    if (seconds < 604800) return Math.floor(seconds / 86400) + ' days ago';

    return new Date(timestamp).toLocaleDateString();
}

// Open sidebar
function openSidebar() {
    const sidebar = document.getElementById('conversation-sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (sidebar) sidebar.classList.add('active');
    if (overlay) overlay.classList.add('active');
}

// Close sidebar
function closeSidebar() {
    const sidebar = document.getElementById('conversation-sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (sidebar) sidebar.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
}

// Initialize Speech Recognition
if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = function () {
        console.log('Voice recognition started. Speak now.');
        const input = document.getElementById('message-input');
        if (input) input.placeholder = "Listening...";
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
            const input = document.getElementById('message-input');
            if (input) input.placeholder = "Describe symptoms or upload prescription...";
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
} else {
    console.warn("Speech Recognition API not supported in this browser.");
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
        if (voiceBtn) voiceBtn.classList.add('recording');
        if (voiceIcon) voiceIcon.className = 'fas fa-stop';
        startVoiceRecognition();
        speakText("Voice mode enabled. I am listening.");
    } else {
        if (voiceBtn) voiceBtn.classList.remove('recording');
        if (voiceIcon) voiceIcon.className = 'fas fa-microphone';
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

    // Cancel any previous speech to avoid overlapping
    window.speechSynthesis.cancel();

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

    addMessage(`📄 Uploaded prescription: ${file.name}`, 'user');
    showTypingIndicator();

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch(`${API_BASE_URL}/api/medical/analyze-prescription`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        removeTypingIndicator();

        const analysisHtml = renderPrescriptionResult(data.analysis);
        addMessage(analysisHtml, 'bot');

        if (data.analysis && data.analysis.medications) {
            const count = data.analysis.medications.length;
            addMessage(`✅ I've extracted ${count} medications and automatically set reminders for you.`, 'bot');

            if (isVoiceMode) {
                speakText(`I have analyzed your prescription and set reminders for ${count} medications.`);
            }

            data.analysis.medications.forEach(med => {
                setReminder(med.name, med.frequency, true);
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
                <p class="mb-1 small"><strong>Dr:</strong> ${analysis.doctor_name || 'N/A'} | <strong>Date:</strong> ${analysis.date || 'N/A'}</p>
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

    addMessage(message, 'user');
    input.value = '';
    showTypingIndicator();

    try {
        const response = await fetch(`${API_BASE_URL}/api/chat/text`, {
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

        let cleanResponse = data.response ? data.response.replace(/\[MED:(.*?)\]/g, '$1') : '';

        if (!actionTriggered && cleanResponse) {
            await addMessage(cleanResponse, 'bot', true);
            if (isVoiceMode) {
                speakText(cleanResponse);
            }
        } else if (actionTriggered && cleanResponse) {
            console.log("Suppressed AI response due to action:", cleanResponse);
        }

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
    const time = new Date();
    time.setSeconds(time.getSeconds() + 5);

    if (!silent) {
        alert(`Reminder set for ${medicineName} (${frequency}).`);
    }

    setTimeout(() => {
        const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
        audio.play().catch(e => console.log('Audio play failed', e));

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
    }, 5000 + (Math.random() * 2000));
}

// Add message to UI only (no saving)
function addMessageToUI(text, sender, stream = false) {
    const chatMessages = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    messageDiv.appendChild(contentDiv);

    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.innerText = 'Just now';
    messageDiv.appendChild(timeDiv);

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    if (stream && sender === 'bot' && !text.trim().startsWith('<')) {
        return typeMessage(text, contentDiv);
    } else {
        if (text.trim().startsWith('<')) {
            contentDiv.innerHTML = text;
        } else {
            const safeText = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            contentDiv.innerHTML = safeText;
        }
        return Promise.resolve();
    }
}

// Add message (with history saving)
function addMessage(text, sender, stream = false) {
    // Save to history (only save plain text, not HTML)
    if (!text.trim().startsWith('<')) {
        saveMessageToHistory(text, sender);
    }

    return addMessageToUI(text, sender, stream);
}

function formatMessage(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
}

function typeMessage(text, element) {
    return new Promise((resolve) => {
        const formatted = formatMessage(text);
        const parts = formatted.match(/(<[^>]+>|[^<]+)/g) || [];
        let i = 0;

        function stream() {
            if (i >= parts.length) {
                resolve();
                return;
            }

            const part = parts[i];
            if (part.startsWith('<')) {
                element.innerHTML += part;
                i++;
                stream();
            } else {
                const words = part.split(' ');
                let w = 0;

                function streamWords() {
                    if (w >= words.length) {
                        i++;
                        stream();
                        return;
                    }
                    element.innerHTML += words[w] + (w < words.length - 1 ? ' ' : '');
                    w++;

                    const chatMessages = document.getElementById('chat-messages');
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                    setTimeout(streamWords, 30 + Math.random() * 40);
                }
                streamWords();
            }
        }
        stream();
    });
}

function showTypingIndicator() {
    const chatMessages = document.getElementById('chat-messages');
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
            const response = await fetch(`${API_BASE_URL}/api/medical/order-medicine?medicine_id=1&user_id=user_123&quantity=1`, {
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

// FIX: This function was broken in the original code
async function buyMedicine(medicineName) {
    console.log(`🛒 Buying medicine: ${medicineName}`);

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

    const updateProgress = (text) => {
        const el = document.getElementById(`${progressId}-text`);
        if (el) el.innerText = text;
    };

    setTimeout(() => updateProgress(`🔍 Searching for ${medicineName} on 1mg...`), 1000);
    setTimeout(() => updateProgress(`💊 Found ${medicineName}. Verifying details...`), 3000);
    setTimeout(() => updateProgress(`🛒 Adding ${medicineName} to cart...`), 5000);
    setTimeout(() => updateProgress(`✅ Verifying cart contents...`), 7000);

    try {
        const response = await fetch(`${API_BASE_URL}/api/medical/buy-medicine`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                medicine_name: medicineName,
                user_id: 'user_123'
            })
        });

        const data = await response.json();

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

            const response = await fetch(`${API_BASE_URL}/api/emergency/hospitals/nearby?latitude=${lat}&longitude=${lon}`);
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
        const response = await fetch(`${API_BASE_URL}/api/appointments/book`, {
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

        if (!navigator.geolocation) {
            removeTypingIndicator();
            addMessage('Location access needed for emergency services!', 'bot');
            return;
        }

        navigator.geolocation.getCurrentPosition(async (position) => {
            try {
                const location = `${position.coords.latitude}, ${position.coords.longitude}`;
                console.log(`🚨 Emergency at real location: ${location}`);

                const response = await fetch(`${API_BASE_URL}/api/emergency/ambulance`, {
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
    if (recommendationsDiv) {
        recommendationsDiv.innerHTML = `<div class="alert alert-info">${formatPrescriptionAnalysis(response)}</div>`;
    }
}

// Simple error handling
window.addEventListener('error', function (e) {
    console.error('Application error:', e.error);
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
    // Initialize sidebar
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebarClose = document.getElementById('sidebar-close');
    const sidebar = document.getElementById('conversation-sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', openSidebar);
    }

    if (sidebarClose) {
        sidebarClose.addEventListener('click', closeSidebar);
    }

    if (overlay) {
        overlay.addEventListener('click', closeSidebar);
    }

    // Initialize event listeners
    const sendButton = document.getElementById('send-button');
    if (sendButton) {
        sendButton.addEventListener('click', sendMessage);
    }

    const voiceButton = document.getElementById('voice-button');
    if (voiceButton) {
        voiceButton.addEventListener('click', toggleVoiceMode);
    }

    const attachButton = document.getElementById('attach-button');
    const fileInput = document.getElementById('chat-file-input');
    if (attachButton && fileInput) {
        attachButton.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', handleFileUpload);
    }

    const alertButton = document.getElementById('alert-button');
    if (alertButton) {
        alertButton.addEventListener('click', triggerEmergency);
    }

    const hospitalButton = document.getElementById('hospital-button');
    if (hospitalButton) {
        hospitalButton.addEventListener('click', toggleHospitalMenu);
    }

    // Load chat history and update sidebar
    updateSidebarUI();

    // Load current conversation if exists
    const currentChatId = getCurrentChatId();
    const history = getChatHistory();
    const currentChat = history.find(c => c.id === currentChatId);

    if (currentChat && currentChat.messages.length > 0) {
        // Clear default message
        const chatMessages = document.getElementById('chat-messages');
        chatMessages.innerHTML = '';

        // Load messages
        currentChat.messages.forEach(msg => {
            addMessageToUI(msg.text, msg.sender);
        });
    }
});

// Toggle hospital menu
function toggleHospitalMenu() {
    const menu = document.getElementById('hospital-menu');
    if (menu) {
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    }
}

// Handle hospital action
function handleHospitalAction(action) {
    const menu = document.getElementById('hospital-menu');
    if (menu) menu.style.display = 'none';

    if (action === 'locate') {
        findHospitals();
    }
}