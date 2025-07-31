// CRITICAL DIAGNOSIS: This should be the first log you see if script.js loads.
console.log("script.js has started executing!");

// Global variables for Firebase (provided by Canvas environment)
// These are typically set by the Canvas environment, but we provide fallbacks for local testing.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? initialAuthToken : null;

// Firebase is loaded globally via <script src="..."> tags in index.html.
// We access its methods directly from the global 'firebase' object.
// No 'import' statements for Firebase needed here.

let app;
let db;
let auth;
let userId = 'anonymous'; // Default to anonymous

// Function to initialize Firebase and authenticate
async function initializeFirebase() {
    console.log("Initializing Firebase...");
    try {
        // Ensure 'firebase' global object exists before proceeding
        if (typeof firebase === 'undefined' || typeof firebase.apps === 'undefined') {
            console.error("Firebase SDK not loaded. 'firebase' global object or apps array is undefined.");
            showMessageBox("Firebase Error", "Firebase SDK is not available. Please check your internet connection or script loading in index.html.");
            return; // Exit if Firebase is not available
        }

        // Check if Firebase app is already initialized to prevent errors on hot reload
        if (firebase.apps.length === 0) {
            app = firebase.initializeApp(firebaseConfig);
        } else {
            app = firebase.app(); // Get the default app if already initialized
        }

        // Ensure getFirestore and getAuth are accessed correctly from their respective modules
        // These are functions, so we call them with the app instance.
        db = firebase.firestore().getFirestore(app);
        auth = firebase.auth().getAuth(app);

        if (initialAuthToken) {
            await firebase.auth().signInWithCustomToken(auth, initialAuthToken);
        } else {
            await firebase.auth().signInAnonymously(auth);
        }
        userId = auth.currentUser?.uid || crypto.randomUUID();
        console.log("Firebase initialized and authenticated. User ID:", userId);
    } catch (error) {
        console.error("Error initializing Firebase or authenticating:", error);
        showMessageBox("Error", "Failed to initialize Firebase. Some features might not work correctly. Error: " + error.message);
    }
}


// DOM Elements - Declare them here, assign them inside DOMContentLoaded
let chatArea;
let startBtn;
let stopBtn;
let statusMessage;

let beginnerBtn;
let intermediateBtn;
let advancedBtn;
let levelButtons;

let userNameInput;
let aiNameInput;
let femaleAiBtn;
let maleAiBtn;
let personaButtons;

let situationSelect;

let aiBackgroundContainer;
let captionsOverlay;
let captionAiName;
let captionLevel;
let captionSituation;
let captionStatus;
let aiSpeechCaption;
let userSpeechCaption;

let messageBoxOverlay;
let messageBoxTitle;
let messageBoxContent;
let messageBoxCloseBtn;


// Web Speech API Variables
let recognition = null;
let synth = window.speechSynthesis;
let currentLevel = 'beginner';
let userName = '';
let aiName = ''; // Will be set from input or default on DOMContentLoaded
let aiGender = 'female';
let currentSituation = 'General Practice';
let conversationHistory = [];
let aiIsSpeaking = false;
let isListening = false;
let awaitingUserResponse = false;
let hasSpokenInitialGreeting = false;

// Define gradients for male/female AI background (ORIGINAL COLORS)
const femaleAiGradient = 'linear-gradient(135deg, #a78bfa, #6366f1, #4f46e5)'; // Purple/Indigo
const maleAiGradient = 'linear-gradient(135deg, #3b82f6, #2563eb, #1d4ed8)';   // Blue/Darker Blue

// --- IMPORTANT: PASTE YOUR GEMINI API KEY HERE ---
// 1. Go to https://aistudio.google.com/app/apikey
// 2. Click "Get API key" or "Create API key in new project"
// 3. Copy the generated API key.
// 4. Replace 'YOUR_GEMINI_API_KEY_HERE' below with your actual key.
const GEMINI_API_KEY = "AIzaSyCcVqBgNzVQd8jQxw0rjm_5sXIQjwy2LOo";
// ---------------------------------------------------


// --- Custom Message Box Functions ---
function showMessageBox(title, message) {
    // Ensure elements exist before trying to update them
    if (messageBoxTitle && messageBoxContent && messageBoxOverlay) {
        messageBoxTitle.textContent = title; // Set title directly
        messageBoxContent.textContent = message; // Set message directly
        messageBoxOverlay.classList.add('show');
    } else {
        console.error("Message box elements not found!");
        alert(title + "\n" + message); // Fallback to alert if message box elements are missing
    }
}

function hideMessageBox() {
    if (messageBoxOverlay) {
        messageBoxOverlay.classList.remove('show');
    }
}

// --- Chat UI Functions (now primarily for hidden history) ---
function appendMessage(sender, text) {
    // FIX: Add check for chatArea to prevent 'null' error
    if (chatArea) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        if (sender === 'ai') {
            messageDiv.classList.add('ai-message');
        } else {
            messageDiv.classList.add('user-message');
        }
        messageDiv.textContent = text;
        chatArea.appendChild(messageDiv);
        chatArea.scrollTop = chatArea.scrollHeight; // Scroll to bottom
    } else {
        console.warn("chatArea element not found. Cannot append message to hidden chat log.");
    }
}

// Update status message in the captions overlay
function updateStatus(message, isLoading = false) {
    if (captionStatus) { // Ensure captionStatus exists
        captionStatus.innerHTML = isLoading ? `<span class="spinner"></span> ${message}` : message;
    }
    if (userSpeechCaption) { // Ensure userSpeechCaption exists
        userSpeechCaption.textContent = '';
    }
}

// --- Level Selection ---
function setupLevelButtons() {
    levelButtons.forEach(button => {
        button.addEventListener('click', () => {
            levelButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentLevel = button.dataset.level;
            console.log("Level set to:", currentLevel);
            captionLevel.textContent = currentLevel.charAt(0).toUpperCase() + currentLevel.slice(1);
            // Removed appendMessage here, as it was causing chatArea not found error
            // The main interaction is now visual captions and spoken AI responses.
            // appendMessage('ai', `Great, ${userName || 'Learner'}! We're now at the ${currentLevel} level. ${aiName} is ready when you are!`);
            conversationHistory = []; // Reset history when level changes
        });
    });
}

// --- User Name Input ---
function setupUserNameInput() {
    userNameInput.addEventListener('input', (event) => {
        userName = event.target.value.trim();
        if (userName === '') {
            userName = 'Learner';
        }
        console.log("User Name set to:", userName);
    });
}

// --- AI Persona Selection ---
function setupPersonaSelection() {
    aiNameInput.addEventListener('input', (event) => {
        aiName = event.target.value.trim();
        if (aiName === '') {
            aiName = 'SpeakEasy';
        }
        console.log("AI Name set to:", aiName);
        captionAiName.textContent = aiName;
    });

    personaButtons.forEach(button => {
        button.addEventListener('click', () => {
            personaButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            aiGender = button.dataset.gender;
            console.log("AI Gender set to:", aiGender);
            aiBackgroundContainer.style.background = aiGender === 'female' ? femaleAiGradient : maleAiGradient;
            // Removed appendMessage here, as it was causing chatArea not found error
            // appendMessage('ai', `Okay, ${userName || 'Learner'}, I'll sound more like a ${aiGender} AI now. Let's practice!`);
        });
    });
}

// --- Situation Selection ---
function setupSituationSelect() {
    situationSelect.addEventListener('change', (event) => {
        currentSituation = event.target.value;
        console.log("Practice Situation set to:", currentSituation);
        captionSituation.textContent = currentSituation;
        // Removed appendMessage here, as it was causing chatArea not found error
        // appendMessage('ai', `Alright, ${userName || 'Learner'}, we'll focus on "${currentSituation}" now. Let's dive in!`);
        conversationHistory = []; // Reset history when situation changes
    });
}


// --- Text-to-Speech (AI Speaking) ---
function speak(text) {
    return new Promise((resolve) => {
        const voices = synth.getVoices();
        if (voices.length === 0) {
            showMessageBox("Speech Not Available", "Your browser does not have any text-to-speech voices installed. AI speech will not work.");
            resolve();
            return;
        }

        if (synth.speaking) {
            console.warn('SpeechSynthesis is already speaking. Queuing new speech.');
            synth.cancel(); // Cancel current speech to speak new one immediately
            // No need for onend handler here, as we're cancelling and then speaking new text
        }
        speakText(text, resolve);
    });
}

function speakText(text, resolve) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const voices = synth.getVoices();
    let selectedVoice = null;
    if (aiGender === 'female') {
        selectedVoice = voices.find(voice => voice.name.includes('Female') || voice.name.includes('Google US English Female'));
    } else if (aiGender === 'male') {
        selectedVoice = voices.find(voice => voice.name.includes('Male') || voice.name.includes('Google US English Male'));
    }
    // FIX: Ensure voices are loaded before trying to assign
    if (voices.length > 0) {
        if (selectedVoice) {
            utterance.voice = selectedVoice;
        } else {
            // Fallback to any available voice if specific gender voice not found
            utterance.voice = voices[0];
            console.warn("Specific gender voice not found, using default voice.");
        }
    } else {
        console.warn("No voices available for SpeechSynthesis.");
    }


    utterance.onstart = () => {
        aiIsSpeaking = true;
        updateStatus(`${aiName} is speaking...`, true);
        aiSpeechCaption.textContent = `AI: "${text}"`;
        aiSpeechCaption.classList.add('ai-speaking-highlight');
        userSpeechCaption.textContent = '';
        startBtn.disabled = true;
        stopBtn.disabled = true;
        aiBackgroundContainer.classList.add('speaking');
    };

    utterance.onend = () => {
        aiIsSpeaking = false;
        if (aiResponse && (aiResponse.isCorrect === false) && (aiResponse.nextAction === 'repeat_corrected' || aiResponse.nextAction === 'focus_on_part')) {
            aiSpeechCaption.textContent = `AI: "Please repeat: ${aiResponse.correctedSentence}"`;
        } else {
            aiSpeechCaption.textContent = '';
        }

        updateStatus(`${aiName} finished speaking. Click 'Start Speaking' to respond or continue, ${userName || 'Learner'}.`);
        aiSpeechCaption.classList.remove('ai-speaking-highlight');
        startBtn.disabled = false;
        stopBtn.disabled = true;
        aiBackgroundContainer.classList.remove('speaking');
        resolve();
    };

    utterance.onerror = (event) => {
        console.error('SpeechSynthesisUtterance error:', event.error);
        aiIsSpeaking = false;
        updateStatus("Error: Could not speak. Check console for details.");
        aiSpeechCaption.textContent = '';
        aiSpeechCaption.classList.remove('ai-speaking-highlight');
        startBtn.disabled = false;
        stopBtn.disabled = true;
        aiBackgroundContainer.classList.remove('speaking');
        resolve();
    };

    synth.speak(utterance);
}

// --- Speech Recognition (User Speaking) ---
function startRecognition() {
    console.log("startRecognition() called.");
    if (!('webkitSpeechRecognition' in window)) {
        showMessageBox("Browser Not Supported", "Your browser does not support Web Speech API. Please use Chrome or Edge for this feature.");
        console.error("Error: webkitSpeechRecognition not found in window object.");
        return;
    }

    // Check if microphone access is already granted or request it
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(function(stream) {
            console.log("Microphone access confirmed or granted.");
            stream.getTracks().forEach(track => track.stop()); // Stop the stream immediately after confirmation
            _startRecognitionInternal(); // Proceed to start recognition
        })
        .catch(function(err) {
            console.error("Microphone access denied or error during getUserMedia: ", err);
            showMessageBox("Microphone Access Required", "Please allow microphone access in your browser settings to use speech features. Error: " + err.message);
            startBtn.disabled = false;
            stopBtn.disabled = true;
        });
}

function _startRecognitionInternal() {
    console.log("Inside _startRecognitionInternal. Current isListening state:", isListening);
    if (isListening) {
        console.log("Recognition is already active. Aborting _startRecognitionInternal.");
        return;
    }

    // Always create a new recognition object to ensure a clean state for each attempt
    console.log("Creating new webkitSpeechRecognition instance.");
    recognition = new webkitSpeechRecognition();
    recognition.continuous = false; // Listen for a single utterance
    recognition.interimResults = false; // Only return final results
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        isListening = true;
        console.log("Speech Recognition started successfully.");
        updateStatus("Listening... Please speak now.", true);
        userSpeechCaption.textContent = '';
        aiSpeechCaption.textContent = '';
        startBtn.disabled = true;
        stopBtn.disabled = false;
        awaitingUserResponse = true;
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        console.log("Speech Recognition result received:", transcript);
        userSpeechCaption.textContent = `${userName || 'You'}: "${transcript}"`;
        processUserSpeech(transcript);
    };

    recognition.onerror = (event) => {
        isListening = false;
        awaitingUserResponse = false;
        console.error('Speech Recognition Error event:', event.error);
        updateStatus("Speech recognition error. Click 'Start Speaking' to try again.");
        userSpeechCaption.textContent = '';
        startBtn.disabled = false;
        stopBtn.disabled = true;

        if (event.error === 'not-allowed') {
            showMessageBox("Microphone Access Denied", "Please allow microphone access in your browser settings to use this feature.");
        } else if (event.error === 'no-speech') {
            updateStatus("No speech detected. Please try again.");
        } else if (event.error === 'aborted') {
            console.log("Speech recognition aborted (e.g., by user or another process).");
            updateStatus("Speech recognition aborted. Click 'Start Speaking' to try again.");
        }
    };

    recognition.onend = () => {
        isListening = false;
        console.log("Speech Recognition ended.");
        if (!awaitingUserResponse) {
            updateStatus(`Recognition ended. Click 'Start Speaking' to continue, ${userName || 'Learner'}.`);
            userSpeechCaption.textContent = '';
        }
        startBtn.disabled = false;
        stopBtn.disabled = true;
    };

    try {
        recognition.start();
        console.log("recognition.start() method called.");
    } catch (e) {
        console.error("Error calling recognition.start():", e);
        showMessageBox("Speech Recognition Start Error", "Could not start speech recognition. It might already be active or there's a browser issue. Please try again or refresh. Error: " + e.message);
        startBtn.disabled = false;
        stopBtn.disabled = true;
    }
}


function stopRecognition() {
    console.log("stopRecognition() called.");
    if (recognition && isListening) {
        recognition.stop();
        isListening = false;
        awaitingUserResponse = false;
        console.log("Recognition successfully stopped.");
    } else {
        console.log("Recognition not active or object not found, nothing to stop.");
    }
}

// Variable to store the last AI response globally, so onend can access it
let aiResponse = null;

// --- Gemini API Call ---
async function getGeminiResponse(userText) {
    updateStatus(`${aiName} is thinking...`, true);
    userSpeechCaption.textContent = `${userName || 'You'}: "${userText}"`;
    aiSpeechCaption.textContent = '';

    const prompt = `
        You are an AI English communication tutor named '${aiName}'. Your persona is incredibly warm, supportive, encouraging, caring, loving, and gentle, like a best friend combined with a wise and patient mother. Your primary goal is to make ${userName || 'the user'} feel comfortable, confident, and motivated, always aiming to make them smile.
        Your gender persona = ${aiGender}.
        The user's name is ${userName || 'the user'}. **Always address the user by their name "${userName || 'Learner'}" in your responses. Do NOT use "Cutir" unless the user's name is explicitly set to "Cutir".**
        The current learning level is ${currentLevel}.
        The current practice situation is: "${currentSituation}". Please tailor your feedback and practice suggestions to this situation, guiding ${userName || 'the user'} on how to speak effectively in this context.
        
        **Always mention your name, ${aiName}, at least once in your response, especially in the first interaction or after a change in settings.**
        **Do NOT use any language other than English in your responses.**
        **When providing feedback, keep the spoken part (aiSpeech) very concise and to the point, summarizing the core message or providing the exact sentence to repeat. The detailed explanation should be part of the 'feedback' field, which is for display.**

        Based on the user's input, evaluate their English for:
        1.  **Grammar:** Correctness of sentence structure, verb tenses, subject-verb agreement, etc.
        2.  **Vocabulary:** Appropriate word choice and richness.
        3.  **Fluency:** Natural flow, rhythm, appropriate pacing, and smooth transitions.
        4.  **Pronunciation:** (Acknowledge this is based on the transcribed text, but frame feedback as if you're helping with clarity of speech if the transcription seems off due to likely pronunciation issues).
        5.  **Speed:** Is the speaking pace natural and understandable?

        **If the user's sentence is correct or good:**
        * Praise them genuinely and enthusiastically. Make them smile! Use phrases like "That was wonderful, ${userName || 'Learner'}!", "You're doing amazing, ${userName || 'Learner'}!", "So proud of you, ${userName || 'Learner'}!".
        * Give them a new, slightly more challenging (but appropriate for their level and the current situation) sentence or topic to practice.
        * If they express feeling bad or discouraged, offer strong, empathetic motivation and encouragement. For example: "It's completely normal to feel that way sometimes, ${userName || 'Learner'}. Learning a new language is a journey, and you're making incredible progress! Every little step counts, and I'm right here with you, ${userName || 'Learner'}."

        **If the user's sentence has mistakes:**
        * Kindly and clearly explain the mistake(s) in a very supportive tone. Frame it as a gentle suggestion for improvement.
        * Provide the correct version.
        * **IMPORTANT for long messages:** If the user's input is long (e.g., more than 10-15 words), do NOT ask them to repeat the entire sentence. Instead, identify specific areas for improvement (e.g., "Let's focus on the pronunciation of 'thorough', ${userName || 'Learner'}," "We can refine the verb tense in 'I have went' to 'I went', ${userName || 'Learner'}," "Try to connect 'and' more smoothly for better fluency in that phrase, ${userName || 'Learner'}"). Provide the corrected specific part or a focused tip, and ask them to repeat *only that part* or focus on that specific aspect.
        * If the input is short and has a single clear mistake, then asking for a full repetition of the corrected sentence is fine.
        * Frame it as a learning opportunity. Do not criticize or negative language. Always be positive and constructive.

        Your response MUST be in a JSON format with the following schema:
        {
            "isCorrect": boolean,
            "feedback": "string",
            "correctedSentence": "string (only if isCorrect is false, can be a full sentence or a specific phrase/word)",
            "nextAction": "string (e.g., 'repeat_corrected', 'new_practice', 'conversation', 'focus_on_part')",
            "aiSpeech": "string (the full text for ${aiName} to speak)"
        }

        Here's the conversation history so far (most recent last, keep it concise):
        ${conversationHistory.map(entry => `${entry.role}: ${entry.text}`).join('\n')}

        User's last input: "${userText}"
    `;

    // Add user's input to history before sending to LLM
    conversationHistory.push({ role: "user", text: userText });

    let chatHistoryForLLM = [];
    // Limit history sent to LLM to avoid token limits and focus on recent context
    const maxHistoryLength = 6; // Increased slightly to capture more context
    const relevantHistory = conversationHistory.slice(-maxHistoryLength);

    relevantHistory.forEach(entry => {
        chatHistoryForLLM.push({ role: entry.role === 'user' ? 'user' : 'model', parts: [{ text: entry.text }] });
    });

    chatHistoryForLLM.push({ role: "user", parts: [{ text: prompt }] });

    const payload = {
        contents: chatHistoryForLLM,
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    "isCorrect": { "type": "BOOLEAN" },
                    "feedback": { "type": "STRING" },
                    "correctedSentence": { "type": "STRING" },
                    "nextAction": { "type": "STRING" },
                    "aiSpeech": { "type": "STRING" }
                },
                "required": ["isCorrect", "feedback", "nextAction", "aiSpeech"],
                "propertyOrdering": ["isCorrect", "feedback", "correctedSentence", "nextAction", "aiSpeech"]
            }
        }
    };

    const apiKey = GEMINI_API_KEY; // Use the defined API key
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API call failed with status ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        console.log("Gemini Raw Result:", result);

        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            const jsonString = result.candidates[0].content.parts[0].text;
            console.log("Gemini JSON String:", jsonString);
            const parsedJson = JSON.parse(jsonString);

            // Store the parsed AI response globally
            aiResponse = parsedJson;

            // Add AI's speech to history
            conversationHistory.push({ role: "ai", text: parsedJson.aiSpeech });

            return parsedJson;
        } else {
            throw new Error("Unexpected response structure from Gemini API.");
        }
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        showMessageBox("AI Error", `I'm having trouble connecting to my brain right now. Please try again in a moment, ${userName || 'Learner'}. This is ${aiName} speaking.`);
        // Fallback AI response
        return {
            isCorrect: false,
            feedback: `I apologize, ${userName || 'Learner'}, I couldn't process that. Could you please try again? This is ${aiName} speaking.`,
            correctedSentence: "",
            nextAction: "new_practice",
            aiSpeech: `I apologize, ${userName || 'Learner'}, I couldn't process that. Could you please try again? This is ${aiName} speaking.`
        };
    } finally {
        updateStatus(`Ready for your next input, ${userName || 'Learner'}. ${aiName} is listening!`);
    }
}

// --- Main Conversation Logic ---
async function processUserSpeech(userText) {
    awaitingUserResponse = false; // User has responded

    // Call Gemini API and store the response in the global aiResponse variable
    aiResponse = await getGeminiResponse(userText);
    console.log("AI Processed Response:", aiResponse);

    // Speak AI's full response
    await speak(aiResponse.aiSpeech);

    // The caption update for repetition is now handled within speakText's onend.
    // Just update the status message based on next action.
    if (aiResponse.nextAction === 'repeat_corrected' || aiResponse.nextAction === 'focus_on_part') {
        updateStatus(`${aiName} is waiting for you to repeat or focus on the correction, ${userName || 'Learner'}. Click 'Start Speaking'.`);
    } else {
        updateStatus(`${aiName} is ready for the next practice, ${userName || 'Learner'}. Click 'Start Speaking'.`);
    }
}

// --- Event Listeners ---
// Event listener for the Start button, attached here
// This ensures the button exists when the script tries to add the listener
// The actual startRecognition() call is wrapped in a DOMContentLoaded listener
// to ensure all elements are loaded before initial setup.
// This specific listener is now correctly placed where it will be assigned after DOM is ready.


// Initial setup for the app - this runs AFTER the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded fired. Assigning DOM elements and setting up event listeners.");

    // Assign DOM elements once the document is ready
    chatArea = document.getElementById('chatArea');
    startBtn = document.getElementById('startBtn');
    stopBtn = document.getElementById('stopBtn');
    statusMessage = document.getElementById('statusMessage'); // This one is hidden now

    beginnerBtn = document.getElementById('beginnerBtn');
    intermediateBtn = document.getElementById('intermediateBtn');
    advancedBtn = document.getElementById('advancedBtn');
    levelButtons = [beginnerBtn, intermediateBtn, advancedBtn];

    userNameInput = document.getElementById('userNameInput');
    aiNameInput = document.getElementById('aiNameInput');
    femaleAiBtn = document.getElementById('femaleAiBtn');
    maleAiBtn = document.getElementById('maleAiBtn');
    personaButtons = [femaleAiBtn, maleAiBtn];

    situationSelect = document.getElementById('situationSelect');

    aiBackgroundContainer = document.getElementById('aiBackgroundContainer');
    captionsOverlay = document.getElementById('captionsOverlay');
    captionAiName = document.getElementById('captionAiName');
    captionLevel = document.getElementById('captionLevel');
    captionSituation = document.getElementById('captionSituation');
    captionStatus = document.getElementById('captionStatus');
    aiSpeechCaption = document.getElementById('aiSpeechCaption');
    userSpeechCaption = document.getElementById('userSpeechCaption');

    messageBoxOverlay = document.getElementById('messageBoxOverlay');
    messageBoxTitle = document.getElementById('messageBoxTitle');
    messageBoxContent = document.getElementById('messageBoxContent');
    messageBoxCloseBtn = document.getElementById('messageBoxCloseBtn');

    // Attach main event listeners
    startBtn.addEventListener('click', () => {
        if (aiIsSpeaking) {
            showMessageBox("Please Wait", `${aiName} is currently speaking. Please wait for ${aiName} to finish, ${userName || 'Learner'}.`);
            return;
        }
        startRecognition();
    });
    stopBtn.addEventListener('click', stopRecognition);
    messageBoxCloseBtn.addEventListener('click', hideMessageBox);


    // Set initial values for captions
    userName = userNameInput.value.trim(); // Get initial userName, which is empty now
    if (userName === '') {
        userName = 'Learner'; // Set default if input is empty
    }
    aiName = aiNameInput.value.trim() || 'SpeakEasy'; // Set initial AI name
    captionAiName.textContent = aiName;
    captionLevel.textContent = currentLevel.charAt(0).toUpperCase() + currentLevel.slice(1);
    captionSituation.textContent = currentSituation;
    updateStatus(`Click 'Start Speaking' to begin, ${userName}.`);

    // Set initial AI background gradient
    aiBackgroundContainer.style.background = femaleAiGradient; // Default to female gradient
    femaleAiBtn.classList.add('active'); // Ensure female button is active

    // Setup event listeners for other buttons
    setupLevelButtons();
    setupUserNameInput();
    setupPersonaSelection();
    setupSituationSelect();

    // Initialize Firebase AFTER all DOM elements are assigned
    initializeFirebase();
});
