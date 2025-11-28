/**
 * Medicine Card Module
 * Handles rendering medicine recommendation cards and calling AI shopping agent
 */

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

// Call AI Shopping Agent
async function buyMedicine(medicineName) {
    console.log(`🛒 Buying medicine: ${medicineName}`);

    // Show loading
    addMessage(`🤖 AI Agent is finding and adding ${medicineName} to cart...`, 'bot');
    showLoading(true);

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

            // Also speak if voice mode is on
            if (typeof isVoiceMode !== 'undefined' && isVoiceMode) {
                speakText(data.message);
            }
        } else {
            addMessage(`❌ Failed to add medicine to cart: ${data.message}`, 'bot');
        }

    } catch (error) {
        console.error('Buy medicine error:', error);
        addMessage('❌ Failed to contact shopping agent. Please try again.', 'bot');
    } finally {
        showLoading(false);
    }
}

// Override sendMessage function to include medicine recommendations
const originalSendMessage = window.sendMessage;
window.sendMessage = async function () {
    const input = document.getElementById('message-input');
    const message = input.value.trim();

    if (!message) return;

    addMessage(message, 'user');
    input.value = '';
    showLoading(true);

    try {
        const response = await fetch('http://localhost:8000/api/chat/text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: message,
                user_id: 'user_123',
                session_id: currentSessionId
            })
        });

        const data = await response.json();

        // Remove [MED:...] markers from response text
        const cleanResponse = data.response.replace(/\[MED:(.*?)\]/g, '$1');
        addMessage(cleanResponse, 'bot');

        // Render medicine cards if recommendations found
        if (data.medicine_recommendations && data.medicine_recommendations.length > 0) {
            renderMedicineCards(data.medicine_recommendations);
        }

        if (typeof isVoiceMode !== 'undefined' && isVoiceMode) {
            speakText(cleanResponse);
        }

        // Also update recommendations panel if needed
        if (typeof updateRecommendations !== 'undefined') {
            updateRecommendations(cleanResponse);
        }

    } catch (error) {
        console.error('Error:', error);
        addMessage('Sorry, I encountered an error. Please try again.', 'bot');
    } finally {
        showLoading(false);
    }
};

console.log('✅ Medicine Cards Module Loaded');
