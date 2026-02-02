
const CUSTOMER_CARE_NUMBER = "14545454";
// GROQ_API_KEY is loaded from config.js

// Combine datasets
const FULL_DATASET = [...GENERAL_QA_DATASET, ...PROP_FIRM_QA_DATASET];

// Format dataset for the AI context
const KNOWLEDGE_BASE_TEXT = FULL_DATASET.map(item => `Q: ${item.question}\nA: ${item.answer}`).join("\n\n");

let state = {
    turn_count: 0,
    last_intent: null,
    satisfaction_asked: false,
    dissatisfaction_count: 0,
    conversation_ended: false
};

const chatMessages = document.querySelector('.chat-messages');
const chatInput = document.querySelector('.chat-input-area input');
const sendBtn = document.querySelector('.send-btn');
const statusText = document.querySelector('.status-text');

// Helper to add message
function addMessage(text, sender, isHtml = false) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender === 'bot' ? 'bot-message' : 'user-message');

    const contentDiv = document.createElement('div');
    contentDiv.classList.add('message-content');
    if (isHtml) {
        contentDiv.innerHTML = text;
    } else {
        contentDiv.textContent = text;
    }

    const timeDiv = document.createElement('div');
    timeDiv.classList.add('message-time');
    timeDiv.textContent = 'Just now';

    messageDiv.appendChild(contentDiv);
    messageDiv.appendChild(timeDiv);
    chatMessages.appendChild(messageDiv);

    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// LOCAL FALLBACK MATCHING (In case API fails)
function findBestMatchFallback(userInput) {
    if (!userInput) return null;

    const STOP_WORDS = new Set([
        "a", "an", "the", "is", "are", "was", "were", "to", "of", "in", "on", "at", "for",
        "by", "with", "about", "how", "what", "when", "where", "who", "why", "can", "could",
        "would", "should", "do", "does", "did", "i", "me", "my", "you", "your", "it", "its",
        "we", "our", "they", "their", "hello", "hi", "hey"
    ]);

    function getTokens(text) {
        return text.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(word => word.length > 0);
    }

    function getMeaningfulTokens(tokens) {
        return tokens.filter(word => !STOP_WORDS.has(word));
    }

    const inputTokens = getTokens(userInput);
    const inputMeaningful = getMeaningfulTokens(inputTokens);

    let bestMatch = null;
    let highestScore = 0;

    for (const item of FULL_DATASET) {
        if (!item.question) continue;

        const questionTokens = getTokens(item.question);
        const questionMeaningful = getMeaningfulTokens(questionTokens);

        const useMeaningful = inputMeaningful.length > 0 && questionMeaningful.length > 0;
        const setA = useMeaningful ? inputMeaningful : inputTokens;
        const setB = useMeaningful ? questionMeaningful : questionTokens;

        let matchCount = 0;
        for (const word of setA) {
            if (setB.includes(word)) {
                matchCount++;
            }
        }

        let score = 0;
        const totalTokens = setA.length + setB.length;
        if (totalTokens > 0) {
            score = (2 * matchCount) / totalTokens;
        }

        const normalizedInput = inputTokens.join(' ');
        const normalizedQuestion = questionTokens.join(' ');

        if (normalizedInput === normalizedQuestion) {
            score = 1.1;
        } else if (normalizedQuestion.includes(normalizedInput) || normalizedInput.includes(normalizedQuestion)) {
            score += 0.2;
        }

        if (score > highestScore) {
            highestScore = score;
            bestMatch = item;
        }
    }

    if (highestScore > 0.3) {
        return bestMatch.answer;
    }
    return null;
}

// Call Groq API with Full Context
async function callGroqAPI(userMessage) {
    const systemPrompt = `
    You are "Chandan's bot beta", a helpful AI assistant created by "Chandan Kumar".
    
    IMPORTANT INSTRUCTIONS:
    1. Do NOT reveal the name of the underlying model (e.g. Llama 3). If asked, say "I am Chandan's bot beta".
    2. You use the KNOWLEDGE BASE provided below to answer user questions.
    3. You ONLY answer questions related to:
       - The KNOWLEDGE BASE content
       - Finance
       - Prop Firms (Proprietary Trading Firms)
       - General greetings/small talk
    4. If the user asks about anything else (e.g., coding, movies, politics), politely refuse and say you can only discuss finance and prop firms.
    5. When answering, use the specific details from the KNOWLEDGE BASE. You can expand on them to be more helpful and natural, but do not contradict the specific rules.
    
    KNOWLEDGE BASE:
    ${KNOWLEDGE_BASE_TEXT}
    `;

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage }
                ],
                // Updated to a currently supported model
                model: "llama-3.3-70b-versatile",
                temperature: 0.5,
                max_tokens: 400
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API Error: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;

    } catch (error) {
        console.error("Groq API Error:", error);

        // Use Fallback silently
        const fallbackResponse = findBestMatchFallback(userMessage);
        if (fallbackResponse) {
            return fallbackResponse;
        }

        return "I'm having trouble connecting to the server and couldn't find a local match. Error: " + error.message;
    }
}

// Handle User Message
async function handleUserMessage() {
    if (state.conversation_ended) return;

    const input = chatInput.value.trim();
    if (!input) return;

    // Add user message
    addMessage(input, 'user');
    chatInput.value = '';

    state.turn_count++;

    // Add temporary loading message
    const loadingDiv = document.createElement('div');
    loadingDiv.classList.add('message', 'bot-message', 'loading-msg');
    loadingDiv.innerHTML = `<div class="message-content">Thinking...</div>`;
    chatMessages.appendChild(loadingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Call API with full context logic
    const responseText = await callGroqAPI(input);

    // Remove loading message
    loadingDiv.remove();

    addMessage(responseText, 'bot', true);

    // Satisfaction Check Logic
    if (state.turn_count >= 3 && !state.satisfaction_asked) {
        setTimeout(() => askSatisfaction(), 1000);
    }
}

function askSatisfaction() {
    const satisfactionDiv = document.createElement('div');
    satisfactionDiv.classList.add('message', 'bot-message');
    satisfactionDiv.innerHTML = `
        <div class="message-content">
            Does this answer clear things up for you?
            <div class="satisfaction-buttons" style="margin-top: 10px; display: flex; gap: 10px;">
                <button onclick="handleSatisfaction('yes')" class="sat-btn">Yes</button>
                <button onclick="handleSatisfaction('no')" class="sat-btn">No</button>
            </div>
        </div>
        <div class="message-time">Just now</div>
    `;
    chatMessages.appendChild(satisfactionDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    state.satisfaction_asked = true;
}

// Expose to window for inline onclicks
window.handleSatisfaction = function (answer) {
    if (state.conversation_ended) return;

    if (answer === 'yes') {
        setTimeout(() => {
            addMessage("Great! If you have more questions regarding any topic, I’m here to help.", 'bot');
            state.satisfaction_asked = false;
            state.dissatisfaction_count = 0;
        }, 500);
    } else {
        state.dissatisfaction_count++;
        if (state.dissatisfaction_count === 1) {
            setTimeout(() => {
                addMessage("I’m sorry about that — let’s sort it out. Can you tell me what part was unclear or what you’d like explained differently?", 'bot');
                state.satisfaction_asked = false;
            }, 500);
        } else if (state.dissatisfaction_count >= 2) {
            setTimeout(() => {
                addMessage(`I don’t want to waste your time. For immediate assistance, please contact our customer care team:<br><br>📞 ${CUSTOMER_CARE_NUMBER}<br><br>They’ll be able to help you right away.<br><br><button onclick="startNewChat()" class="sat-btn" style="background-color: var(--primary-color); color: white; margin-top: 10px;">Start New Chat</button>`, 'bot', true);
                state.conversation_ended = true;
                statusText.textContent = "Offline";
                statusText.style.color = "gray";
                document.querySelector('.status-dot').style.backgroundColor = "gray";
                chatInput.disabled = true;
                sendBtn.disabled = true;
            }, 500);
        }
    }

    // Remove buttons to prevent multiple clicks
    const btns = document.querySelectorAll('.sat-btn');
    btns.forEach(btn => {
        if (!btn.getAttribute('onclick').includes('startNewChat')) {
            btn.remove();
        }
    });
};

const SUGGESTED_QUESTIONS = [
    "What is a prop firm?",
    "How to take a payout",
    "Drawdown rules",
    "Profit split"
];

function showWelcomeMessage() {
    const welcomeMsg = `Hello! I'm your Intelligent Assistant. I can explain rules, challenges, risk limits, payouts, and operational policies. How can I help you today?`;

    // Create suggestion chips HTML
    const suggestionsHtml = `
        <div class="suggestion-container">
            ${SUGGESTED_QUESTIONS.map(q =>
        `<button onclick="handleSuggestion('${q}')" class="suggestion-chip">${q}</button>`
    ).join('')}
        </div>
    `;

    addMessage(welcomeMsg + suggestionsHtml, 'bot', true);
}

window.handleSuggestion = function (text) {
    if (state.conversation_ended) return;
    chatInput.value = text;
    handleUserMessage();
};

window.startNewChat = function () {
    // Reset State
    state = {
        turn_count: 0,
        last_intent: null,
        satisfaction_asked: false,
        dissatisfaction_count: 0,
        conversation_ended: false
    };

    // Reset UI
    chatMessages.innerHTML = '';

    // Add Welcome Message with Suggestions
    showWelcomeMessage();

    // Re-enable Input
    chatInput.disabled = false;
    sendBtn.disabled = false;
    chatInput.value = '';
    chatInput.focus();

    // Reset Status
    statusText.textContent = "Online";
    statusText.style.color = "#666666";
    document.querySelector('.status-dot').style.backgroundColor = "#34d399";
};

// Initialize chat on load
startNewChat();

// Event Listeners
sendBtn.addEventListener('click', handleUserMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleUserMessage();
});

// Header Reset Button
document.getElementById('header-reset-btn').addEventListener('click', startNewChat);

// Widget Toggle Logic
const chatContainer = document.querySelector('.chat-container');
const chatLauncher = document.getElementById('chat-launcher');
const closeBtn = document.getElementById('header-close-btn');
const launcherIcon = document.querySelector('.launcher-icon');
const closeIcon = document.querySelector('.close-icon');

function toggleChat() {
    const isActive = chatContainer.classList.contains('active');

    if (isActive) {
        chatContainer.classList.remove('active');
        launcherIcon.style.display = 'block';
        closeIcon.style.display = 'none';
    } else {
        chatContainer.classList.add('active');
        launcherIcon.style.display = 'none';
        closeIcon.style.display = 'block';
        // Focus input when opened
        setTimeout(() => chatInput.focus(), 300);
    }
}

chatLauncher.addEventListener('click', toggleChat);
closeBtn.addEventListener('click', () => {
    chatContainer.classList.remove('active');
    launcherIcon.style.display = 'block';
    closeIcon.style.display = 'none';
});
