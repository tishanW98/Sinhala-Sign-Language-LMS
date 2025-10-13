// Configuration
const letters = ['අ', 'ආ', 'ඇ', 'ඈ', 'එ', 'ඒ', 'ඉ', 'ඊ', 'උ', 'ඌ'];
const THRESHOLD = 0.6;
const REQUIRED_ATTEMPTS = 3;
const STREAK_BONUS = 5; // Bonus points for consecutive correct signs

// Add this new mapping: English (from backend/model) to Sinhala (for UI comparison/display)
const englishToSinhala = {
    'a_': 'අ',
    'aa_': 'ආ',
    'ae_': 'ඇ',
    'aee_': 'ඈ',
    'e_': 'එ',
    'ee_': 'ඒ',
    'i_': 'ඉ',
    'ii_': 'ඊ',
    'u_': 'උ',
    'uu_': 'ඌ'
    // Add more if your actions.npy has additional/different labels
};

// Global variables
let video, canvas, ctx, ws;
let captureTimer = null;
let currentLetterIndex = 0;
let attempts = 0;
let correctAttempts = 0;
let totalAttempts = 0;
let successfulSigns = 0;
let currentStreak = 0;
let lastPrediction = null;
let predictionStabilityCount = 0;

// Load progress from memory storage
let completedLetters = [];
let letterStats = {};

// Initialize letter stats
letters.forEach(letter => {
    letterStats[letter] = {
        attempts: 0,
        successes: 0,
        lastCompleted: null
    };
});

// Load saved progress
function loadProgress() {
    // Using in-memory storage - data persists during session only
    if (window.practiceProgress) {
        completedLetters = window.practiceProgress.completed || [];
        letterStats = window.practiceProgress.stats || letterStats;
        totalAttempts = window.practiceProgress.totalAttempts || 0;
        successfulSigns = window.practiceProgress.successfulSigns || 0;
        currentStreak = window.practiceProgress.currentStreak || 0;
    }
}

// Save progress
function saveProgress() {
    window.practiceProgress = {
        completed: completedLetters,
        stats: letterStats,
        totalAttempts: totalAttempts,
        successfulSigns: successfulSigns,
        currentStreak: currentStreak
    };
}

// Initialize webcam
function initWebcam() {
    video = document.getElementById('webcam');
    if (!video) return;

    navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 }, 
        audio: false 
    })
    .then(stream => {
        video.srcObject = stream;
        video.play();
        
        video.onloadedmetadata = () => {
            console.log('✓ Video ready');
            initWebSocket();
        };
    })
    .catch(err => {
        console.error('Webcam error:', err);
        updatePredictionText('Error: Cannot access webcam', 'error');
    });
}

// Build WebSocket URL
function buildWsUrl() {
    const loc = window.location;
    const isSecure = loc.protocol === 'https:';
    const wsProtocol = isSecure ? 'wss' : 'ws';
    let host = loc.host || 'localhost:8001';
    return `${wsProtocol}://${host}/ws/predict`;
}

// Initialize WebSocket
function initWebSocket() {
    const url = buildWsUrl();
    console.log('Connecting to:', url);
    
    ws = new WebSocket(url);
    
    ws.onopen = () => {
        console.log('✓ WebSocket connected');
        startCapturing();
        initPracticeMode();
        updatePredictionText('Ready! Start signing...', 'waiting');
    };
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handlePrediction(data);
        } catch (err) {
            console.error('Error parsing message:', err);
        }
    };
    
    ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        updatePredictionText('Connection error. Please refresh.', 'error');
    };
    
    ws.onclose = () => {
        console.log('WebSocket closed');
        stopCapturing();
        updatePredictionText('Disconnected. Reconnecting...', 'waiting');
        setTimeout(initWebSocket, 2000);
    };
}

// Start capturing frames
function startCapturing() {
    if (!video || !ws || ws.readyState !== WebSocket.OPEN) return;
    if (captureTimer) return;

    if (!canvas) {
        canvas = document.createElement('canvas');
        ctx = canvas.getContext('2d');
    }
    
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    
    console.log('✓ Starting frame capture');

    const capture = () => {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            stopCapturing();
            return;
        }
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob(blob => {
            if (!blob) return;
            blob.arrayBuffer().then(buffer => {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(buffer);
                }
            });
        }, 'image/jpeg', 0.85);
    };

    captureTimer = setInterval(capture, 100); // 10 FPS
}

// Stop capturing
function stopCapturing() {
    if (captureTimer) {
        clearInterval(captureTimer);
        captureTimer = null;
    }
}

// Initialize practice mode
function initPracticeMode() {
    console.log('Initializing practice mode...');
    loadProgress();
    renderLetterGrid();
    updateLetterDisplay();
    updateOverallProgress();
    updateStats();
    
    // Next button
    document.getElementById('next-button').addEventListener('click', () => {
        moveToNextLetter();
    });
    
    // Skip button
    document.getElementById('skip-button').addEventListener('click', () => {
        if (confirm('Are you sure you want to skip this letter?')) {
            moveToNextLetter();
        }
    });
}

// Render letter grid
function renderLetterGrid() {
    const grid = document.getElementById('letter-grid');
    grid.innerHTML = '';
    
    letters.forEach((letter, index) => {
        const item = document.createElement('div');
        item.className = 'letter-item';
        item.textContent = letter;
        
        if (completedLetters.includes(letter)) {
            item.classList.add('completed');
            item.title = 'Mastered! ✓';
        }
        
        if (index === currentLetterIndex) {
            item.classList.add('current');
            item.title = 'Current letter';
        }
        
        item.addEventListener('click', () => {
            if (confirm(`Switch to practicing "${letter}"?`)) {
                currentLetterIndex = index;
                attempts = 0;
                correctAttempts = 0;
                updateLetterDisplay();
            }
        });
        
        grid.appendChild(item);
    });
    
    document.getElementById('total-count').textContent = letters.length;
}

// Update letter display
function updateLetterDisplay() {
    const letter = letters[currentLetterIndex];
    document.getElementById('current-letter').textContent = letter;
    
    const img = document.getElementById('sign-image');
    img.src = `images/${letter}.jpg`;
    img.onerror = () => {
        img.src = 'images/placeholder.jpg';
    };
    
    updateAttemptsIndicator();
    renderLetterGrid();
    
    const feedbackBox = document.getElementById('feedback-box');
    feedbackBox.className = 'feedback-box feedback-waiting';
    feedbackBox.textContent = 'Show me the sign for ' + letter;
    
    document.getElementById('next-button').disabled = true;
}

// Update attempts indicator
function updateAttemptsIndicator() {
    const indicator = document.getElementById('attempts-indicator');
    indicator.innerHTML = '';
    
    for (let i = 0; i < REQUIRED_ATTEMPTS; i++) {
        const dot = document.createElement('div');
        dot.className = 'attempt-dot';
        if (i < correctAttempts) {
            dot.classList.add('completed');
        }
        indicator.appendChild(dot);
    }
}

// Handle prediction from backend
function handlePrediction(data) {
    const expectedLetter = letters[currentLetterIndex];
    
    if (!data.ready) {
        updatePredictionText('Processing...', 'waiting');
        return;
    }
    
    // Update confidence meter
    updateConfidenceMeter(data.confidence);
    
    // Map the backend's English prediction to Sinhala for UI consistency
    const detectedSinhala = englishToSinhala[data.predicted_action] || data.predicted_action; // Fallback to raw if no match
    
    // Check for prediction stability
    if (lastPrediction === detectedSinhala) {  // Use mapped value for stability check
        predictionStabilityCount++;
    } else {
        predictionStabilityCount = 1;
        lastPrediction = detectedSinhala;
    }
    
    // Display current prediction (using Sinhala for user-friendliness)
    const confidencePercent = (data.confidence * 100).toFixed(1);
    updatePredictionText(
        `Detected: ${detectedSinhala} (${confidencePercent}%)`,
        detectedSinhala === expectedLetter ? 'success' : 'waiting'
    );
    
    // Only count as attempt if prediction is stable (detected for 3+ frames)
    if (predictionStabilityCount >= 3 && data.confidence >= THRESHOLD) {
        if (detectedSinhala === expectedLetter) {
            handleCorrectSign();
        } else {
            handleIncorrectSign(detectedSinhala);  // Pass mapped value for feedback
        }
        // Reset stability counter after processing
        predictionStabilityCount = 0;
        lastPrediction = null;
    }
}

// Handle correct sign
function handleCorrectSign() {
    const letter = letters[currentLetterIndex];
    
    // Prevent duplicate counting
    if (correctAttempts >= REQUIRED_ATTEMPTS) return;
    
    correctAttempts++;
    attempts++;
    totalAttempts++;
    successfulSigns++;
    currentStreak++;
    
    letterStats[letter].attempts++;
    letterStats[letter].successes++;
    
    updateAttemptsIndicator();
    updateStats();
    
    // Play success sound (if you add audio)
    playSound('success');
    
    // Update feedback
    const feedbackBox = document.getElementById('feedback-box');
    feedbackBox.className = 'feedback-box feedback-success';
    
    if (correctAttempts >= REQUIRED_ATTEMPTS) {
        feedbackBox.innerHTML = `🎉 Perfect! Letter mastered!<br><small>Click "Next Letter" to continue</small>`;
        completeCurrentLetter();
    } else {
        const remaining = REQUIRED_ATTEMPTS - correctAttempts;
        feedbackBox.textContent = `✓ Correct! ${remaining} more to go!`;
        
        // Auto-reset feedback after 2 seconds
        setTimeout(() => {
            if (correctAttempts < REQUIRED_ATTEMPTS) {
                feedbackBox.className = 'feedback-box feedback-waiting';
                feedbackBox.textContent = `Keep going! Show me "${letter}" again`;
            }
        }, 2000);
    }
    
    saveProgress();
}

// Handle incorrect sign
function handleIncorrectSign(detected) {
    const letter = letters[currentLetterIndex];
    
    attempts++;
    totalAttempts++;
    currentStreak = 0;
    
    letterStats[letter].attempts++;
    
    updateStats();
    
    // Play error sound (if you add audio)
    playSound('error');
    
    const feedbackBox = document.getElementById('feedback-box');
    feedbackBox.className = 'feedback-box feedback-error';
    feedbackBox.textContent = `✗ Not quite! Expected "${letter}", detected "${detected}"`;
    
    // Auto-reset feedback
    setTimeout(() => {
        feedbackBox.className = 'feedback-box feedback-waiting';
        feedbackBox.textContent = `Try again! Show me "${letter}"`;
    }, 2000);
    
    saveProgress();
}

// Complete current letter
function completeCurrentLetter() {
    const letter = letters[currentLetterIndex];
    
    if (!completedLetters.includes(letter)) {
        completedLetters.push(letter);
        letterStats[letter].lastCompleted = new Date().toISOString();
    }
    
    saveProgress();
    updateOverallProgress();
    renderLetterGrid();
    
    // Enable next button
    document.getElementById('next-button').disabled = false;
    
    // Show completion modal
    showCompletionModal(letter);
}

// Show completion modal
function showCompletionModal(letter) {
    const modal = document.getElementById('completion-modal');
    document.getElementById('completed-letter').textContent = letter;
    document.getElementById('modal-attempts').textContent = attempts;
    
    const accuracy = attempts > 0 ? ((correctAttempts / attempts) * 100).toFixed(0) : 0;
    document.getElementById('modal-accuracy').textContent = accuracy + '%';
    
    modal.classList.add('show');
    
    // Auto-close after 3 seconds
    setTimeout(() => {
        modal.classList.remove('show');
    }, 3000);
}

// Close completion modal
function closeCompletionModal() {
    document.getElementById('completion-modal').classList.remove('show');
}
window.closeCompletionModal = closeCompletionModal;

// Move to next letter
function moveToNextLetter() {
    currentLetterIndex++;
    
    if (currentLetterIndex >= letters.length) {
        // All letters completed!
        if (confirm('🎉 Congratulations! You completed all letters!\n\nStart over from the beginning?')) {
            currentLetterIndex = 0;
        } else {
            currentLetterIndex = letters.length - 1;
            return;
        }
    }
    
    attempts = 0;
    correctAttempts = 0;
    predictionStabilityCount = 0;
    lastPrediction = null;
    
    updateLetterDisplay();
}

// Update overall progress
function updateOverallProgress() {
    const completed = completedLetters.length;
    const total = letters.length;
    const percentage = (completed / total) * 100;
    
    const progressBar = document.getElementById('overall-progress');
    progressBar.style.width = percentage + '%';
    progressBar.textContent = Math.round(percentage) + '%';
    
    document.getElementById('completed-count').textContent = completed;
}

// Update statistics
function updateStats() {
    document.getElementById('total-attempts').textContent = totalAttempts;
    
    const successRate = totalAttempts > 0 
        ? ((successfulSigns / totalAttempts) * 100).toFixed(0) 
        : 0;
    document.getElementById('success-rate').textContent = successRate + '%';
    
    document.getElementById('current-streak').textContent = currentStreak;
}

// Update prediction text
function updatePredictionText(text, type) {
    const el = document.getElementById('prediction-text');
    if (el) {
        el.textContent = text;
        el.className = 'detection-overlay';
        if (type === 'error') el.style.color = '#dc3545';
        else if (type === 'success') el.style.color = '#28a745';
        else el.style.color = 'white';
    }
}

// Update confidence meter
function updateConfidenceMeter(confidence) {
    const fill = document.getElementById('confidence-fill');
    if (fill) {
        const percentage = (confidence * 100).toFixed(0);
        fill.style.width = percentage + '%';
    }
}

// Play sound (placeholder - add actual sound files if needed)
function playSound(type) {
    // You can add audio files and play them here
    // const audio = new Audio(`sounds/${type}.mp3`);
    // audio.play();
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('Practice mode loading...');
    
    // Initialize accessibility features if available
    if (window.accessibilityManager) {
        window.accessibilityManager.announce('Practice mode loaded. Camera initialization starting.');
    }
    
    // Initialize performance monitoring if available
    if (window.performanceManager) {
        performance.mark('practice-mode-start');
    }
    
    initWebcam();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopCapturing();
    if (ws) ws.close();
    if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
    }
});