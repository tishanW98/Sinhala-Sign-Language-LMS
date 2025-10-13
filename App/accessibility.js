/**
 * Accessibility Enhancement Module for Sinhala Sign Language LMS
 * Implements WCAG 2.1 AA standards and provides assistive features
 */

class AccessibilityManager {
    constructor() {
        this.isInitialized = false;
        this.preferences = this.loadPreferences();
        this.announcer = null;
        this.keyboardNavigation = false;
        this.highContrast = false;
        this.reducedMotion = false;
        
        this.init();
    }

    init() {
        if (this.isInitialized) return;
        
        this.setupAnnouncer();
        this.detectSystemPreferences();
        this.setupKeyboardNavigation();
        this.setupFocusManagement();
        this.setupScreenReaderSupport();
        this.setupHighContrastMode();
        this.setupReducedMotion();
        this.setupColorBlindSupport();
        this.setupVoiceCommands();
        
        this.isInitialized = true;
        console.log('✓ Accessibility features initialized');
    }

    // Screen Reader Support
    setupAnnouncer() {
        this.announcer = document.createElement('div');
        this.announcer.setAttribute('aria-live', 'polite');
        this.announcer.setAttribute('aria-atomic', 'true');
        this.announcer.className = 'sr-only';
        this.announcer.id = 'accessibility-announcer';
        document.body.appendChild(this.announcer);
    }

    announce(message, priority = 'polite') {
        if (!this.announcer) return;
        
        this.announcer.setAttribute('aria-live', priority);
        this.announcer.textContent = message;
        
        // Clear after announcement
        setTimeout(() => {
            this.announcer.textContent = '';
        }, 1000);
    }

    // System Preferences Detection
    detectSystemPreferences() {
        // Reduced motion preference
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            this.enableReducedMotion();
        }

        // High contrast preference
        if (window.matchMedia('(prefers-contrast: high)').matches) {
            this.enableHighContrast();
        }

        // Color scheme preference
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            this.enableDarkMode();
        }
    }

    // Keyboard Navigation
    setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardNavigation(e);
        });

        // Track keyboard usage
        document.addEventListener('keydown', () => {
            this.keyboardNavigation = true;
            document.body.classList.add('keyboard-navigation');
        });

        document.addEventListener('mousedown', () => {
            this.keyboardNavigation = false;
            document.body.classList.remove('keyboard-navigation');
        });
    }

    handleKeyboardNavigation(e) {
        // Skip links
        if (e.key === 'Tab' && !e.shiftKey) {
            this.handleTabNavigation(e);
        }

        // Escape key for modals and overlays
        if (e.key === 'Escape') {
            this.handleEscapeKey(e);
        }

        // Arrow keys for custom components
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            this.handleArrowNavigation(e);
        }

        // Enter and Space for custom buttons
        if (['Enter', ' '].includes(e.key)) {
            this.handleActivation(e);
        }
    }

    handleTabNavigation(e) {
        const focusableElements = this.getFocusableElements();
        const currentIndex = focusableElements.indexOf(document.activeElement);
        
        if (currentIndex === -1) return;

        // Skip to main content if needed
        if (e.target.classList.contains('skip-link')) {
            e.preventDefault();
            const mainContent = document.querySelector('main, .main-container');
            if (mainContent) {
                mainContent.focus();
                mainContent.scrollIntoView();
            }
        }
    }

    handleEscapeKey(e) {
        // Close modals
        const openModal = document.querySelector('.modal.show, .completion-modal.show, .results-modal.show');
        if (openModal) {
            const closeButton = openModal.querySelector('[data-dismiss="modal"], .btn-close');
            if (closeButton) {
                closeButton.click();
            }
        }
    }

    handleArrowNavigation(e) {
        const target = e.target;
        
        // Handle letter grid navigation
        if (target.closest('.letter-grid')) {
            this.navigateLetterGrid(e, target);
        }
        
        // Handle option buttons in exam
        if (target.closest('.answer-options')) {
            this.navigateAnswerOptions(e, target);
        }
    }

    navigateLetterGrid(e, currentElement) {
        e.preventDefault();
        const grid = currentElement.closest('.letter-grid');
        const items = Array.from(grid.querySelectorAll('.letter-item'));
        const currentIndex = items.indexOf(currentElement);
        
        let nextIndex;
        const cols = Math.floor(grid.offsetWidth / 80); // Approximate columns
        
        switch (e.key) {
            case 'ArrowRight':
                nextIndex = currentIndex + 1;
                break;
            case 'ArrowLeft':
                nextIndex = currentIndex - 1;
                break;
            case 'ArrowDown':
                nextIndex = currentIndex + cols;
                break;
            case 'ArrowUp':
                nextIndex = currentIndex - cols;
                break;
        }
        
        if (nextIndex >= 0 && nextIndex < items.length) {
            items[nextIndex].focus();
        }
    }

    navigateAnswerOptions(e, currentElement) {
        e.preventDefault();
        const container = currentElement.closest('.answer-options');
        const options = Array.from(container.querySelectorAll('.option-button'));
        const currentIndex = options.indexOf(currentElement);
        
        let nextIndex;
        switch (e.key) {
            case 'ArrowRight':
            case 'ArrowDown':
                nextIndex = (currentIndex + 1) % options.length;
                break;
            case 'ArrowLeft':
            case 'ArrowUp':
                nextIndex = (currentIndex - 1 + options.length) % options.length;
                break;
        }
        
        if (nextIndex >= 0) {
            options[nextIndex].focus();
        }
    }

    handleActivation(e) {
        const target = e.target;
        
        // Handle custom button activation
        if (target.classList.contains('letter-item') || 
            target.classList.contains('option-button')) {
            e.preventDefault();
            target.click();
        }
    }

    // Focus Management
    setupFocusManagement() {
        // Skip link
        this.createSkipLink();
        
        // Focus trap for modals
        this.setupFocusTrap();
        
        // Focus restoration
        this.setupFocusRestoration();
    }

    createSkipLink() {
        const skipLink = document.createElement('a');
        skipLink.href = '#main-content';
        skipLink.className = 'skip-link sr-only';
        skipLink.textContent = 'Skip to main content';
        skipLink.style.cssText = `
            position: absolute;
            top: -40px;
            left: 6px;
            background: var(--primary-600);
            color: white;
            padding: 8px;
            text-decoration: none;
            border-radius: 4px;
            z-index: 10000;
            transition: top 0.3s;
        `;
        
        skipLink.addEventListener('focus', () => {
            skipLink.style.top = '6px';
        });
        
        skipLink.addEventListener('blur', () => {
            skipLink.style.top = '-40px';
        });
        
        document.body.insertBefore(skipLink, document.body.firstChild);
    }

    setupFocusTrap() {
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab') return;
            
            const modal = document.querySelector('.modal.show, .completion-modal.show, .results-modal.show');
            if (!modal) return;
            
            const focusableElements = modal.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            
            if (focusableElements.length === 0) return;
            
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];
            
            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                }
            } else {
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        });
    }

    setupFocusRestoration() {
        let lastFocusedElement = null;
        
        document.addEventListener('focusin', (e) => {
            if (!e.target.closest('.modal, .completion-modal, .results-modal')) {
                lastFocusedElement = e.target;
            }
        });
        
        // Restore focus when modal closes
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-backdrop') || 
                e.target.classList.contains('btn-close')) {
                setTimeout(() => {
                    if (lastFocusedElement) {
                        lastFocusedElement.focus();
                    }
                }, 100);
            }
        });
    }

    // Screen Reader Support
    setupScreenReaderSupport() {
        // Add ARIA labels to interactive elements
        this.addAriaLabels();
        
        // Setup live regions for dynamic content
        this.setupLiveRegions();
        
        // Add role attributes
        this.addRoleAttributes();
    }

    addAriaLabels() {
        // Webcam video
        const webcam = document.getElementById('webcam');
        if (webcam) {
            webcam.setAttribute('aria-label', 'Webcam feed for sign recognition');
        }
        
        // Progress indicators
        const progressBars = document.querySelectorAll('.progress-bar');
        progressBars.forEach(bar => {
            if (!bar.getAttribute('aria-label')) {
                const percentage = bar.style.width || '0%';
                bar.setAttribute('aria-label', `Progress: ${percentage}`);
            }
        });
        
        // Letter items
        const letterItems = document.querySelectorAll('.letter-item');
        letterItems.forEach((item, index) => {
            const letter = item.textContent;
            const status = item.classList.contains('completed') ? 'completed' : 
                          item.classList.contains('current') ? 'current' : 'not started';
            item.setAttribute('aria-label', `Letter ${letter}, ${status}`);
        });
    }

    setupLiveRegions() {
        // Prediction text
        const predictionText = document.getElementById('prediction-text');
        if (predictionText) {
            predictionText.setAttribute('aria-live', 'polite');
        }
        
        // Feedback boxes
        const feedbackBoxes = document.querySelectorAll('.feedback-box');
        feedbackBoxes.forEach(box => {
            box.setAttribute('aria-live', 'polite');
            box.setAttribute('role', 'status');
        });
    }

    addRoleAttributes() {
        // Letter grid
        const letterGrid = document.getElementById('letter-grid');
        if (letterGrid) {
            letterGrid.setAttribute('role', 'grid');
            letterGrid.setAttribute('aria-label', 'Sinhala letters progress');
        }
        
        // Answer options
        const answerOptions = document.getElementById('answer-options');
        if (answerOptions) {
            answerOptions.setAttribute('role', 'radiogroup');
            answerOptions.setAttribute('aria-label', 'Answer options');
        }
    }

    // High Contrast Mode
    setupHighContrastMode() {
        const toggle = this.createHighContrastToggle();
        if (toggle) {
            document.body.appendChild(toggle);
        }
    }

    createHighContrastToggle() {
        const toggle = document.createElement('button');
        toggle.className = 'accessibility-toggle';
        toggle.innerHTML = '🔍';
        toggle.title = 'Toggle high contrast mode';
        toggle.setAttribute('aria-label', 'Toggle high contrast mode');
        toggle.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 50px;
            height: 50px;
            border: none;
            border-radius: 50%;
            background: var(--primary-600);
            color: white;
            font-size: 20px;
            cursor: pointer;
            z-index: 1000;
            box-shadow: var(--shadow-lg);
        `;
        
        toggle.addEventListener('click', () => {
            this.toggleHighContrast();
        });
        
        return toggle;
    }

    enableHighContrast() {
        this.highContrast = true;
        document.body.classList.add('high-contrast');
        this.announce('High contrast mode enabled');
    }

    disableHighContrast() {
        this.highContrast = false;
        document.body.classList.remove('high-contrast');
        this.announce('High contrast mode disabled');
    }

    toggleHighContrast() {
        if (this.highContrast) {
            this.disableHighContrast();
        } else {
            this.enableHighContrast();
        }
        this.savePreferences();
    }

    // Reduced Motion
    setupReducedMotion() {
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        mediaQuery.addEventListener('change', (e) => {
            if (e.matches) {
                this.enableReducedMotion();
            } else {
                this.disableReducedMotion();
            }
        });
    }

    enableReducedMotion() {
        this.reducedMotion = true;
        document.body.classList.add('reduced-motion');
        this.announce('Reduced motion enabled');
    }

    disableReducedMotion() {
        this.reducedMotion = false;
        document.body.classList.remove('reduced-motion');
    }

    // Color Blind Support
    setupColorBlindSupport() {
        this.addColorBlindIndicators();
    }

    addColorBlindIndicators() {
        // Add text indicators to color-coded elements
        const statusElements = document.querySelectorAll('.letter-item, .option-button');
        statusElements.forEach(element => {
            if (element.classList.contains('completed')) {
                element.setAttribute('data-status', 'completed');
            } else if (element.classList.contains('current')) {
                element.setAttribute('data-status', 'current');
            } else if (element.classList.contains('selected')) {
                element.setAttribute('data-status', 'selected');
            }
        });
    }

    // Voice Commands
    setupVoiceCommands() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            this.initializeVoiceCommands();
        }
    }

    initializeVoiceCommands() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';

        this.recognition.onresult = (event) => {
            const command = event.results[0][0].transcript.toLowerCase().trim();
            this.handleVoiceCommand(command);
        };

        // Add voice command button
        const voiceButton = this.createVoiceCommandButton();
        if (voiceButton) {
            document.body.appendChild(voiceButton);
        }
    }

    createVoiceCommandButton() {
        const button = document.createElement('button');
        button.className = 'voice-command-button';
        button.innerHTML = '🎤';
        button.title = 'Voice commands';
        button.setAttribute('aria-label', 'Start voice commands');
        button.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            width: 50px;
            height: 50px;
            border: none;
            border-radius: 50%;
            background: var(--secondary-600);
            color: white;
            font-size: 20px;
            cursor: pointer;
            z-index: 1000;
            box-shadow: var(--shadow-lg);
        `;
        
        button.addEventListener('click', () => {
            this.startVoiceCommands();
        });
        
        return button;
    }

    startVoiceCommands() {
        if (this.recognition) {
            this.recognition.start();
            this.announce('Voice commands activated. Say "help" for available commands.');
        }
    }

    handleVoiceCommand(command) {
        const commands = {
            'start practice': () => window.location.href = 'practice.html',
            'take exam': () => window.location.href = 'exam.html',
            'view dashboard': () => window.location.href = 'dashboard.html',
            'go home': () => window.location.href = 'index.html',
            'next letter': () => this.triggerNextLetter(),
            'skip': () => this.triggerSkip(),
            'submit': () => this.triggerSubmit(),
            'help': () => this.showVoiceHelp()
        };

        for (const [key, action] of Object.entries(commands)) {
            if (command.includes(key)) {
                action();
                this.announce(`Executing: ${key}`);
                return;
            }
        }

        this.announce('Command not recognized. Say "help" for available commands.');
    }

    triggerNextLetter() {
        const nextButton = document.getElementById('next-button');
        if (nextButton && !nextButton.disabled) {
            nextButton.click();
        }
    }

    triggerSkip() {
        const skipButton = document.getElementById('skip-button') || 
                          document.getElementById('skip-question-button');
        if (skipButton) {
            skipButton.click();
        }
    }

    triggerSubmit() {
        const submitButton = document.getElementById('submit-button');
        if (submitButton && !submitButton.disabled) {
            submitButton.click();
        }
    }

    showVoiceHelp() {
        const helpText = `
            Available voice commands:
            - "Start practice" - Go to practice mode
            - "Take exam" - Go to exam mode
            - "View dashboard" - Go to dashboard
            - "Go home" - Go to home page
            - "Next letter" - Move to next letter
            - "Skip" - Skip current item
            - "Submit" - Submit current answer
            - "Help" - Show this help
        `;
        this.announce(helpText, 'assertive');
    }

    // Utility Methods
    getFocusableElements() {
        return Array.from(document.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )).filter(el => !el.disabled && el.offsetParent !== null);
    }

    loadPreferences() {
        const saved = localStorage.getItem('accessibility-preferences');
        return saved ? JSON.parse(saved) : {};
    }

    savePreferences() {
        const preferences = {
            highContrast: this.highContrast,
            reducedMotion: this.reducedMotion
        };
        localStorage.setItem('accessibility-preferences', JSON.stringify(preferences));
    }

    // Public API
    announceToScreenReader(message, priority = 'polite') {
        this.announce(message, priority);
    }

    setFocus(element) {
        if (element && typeof element.focus === 'function') {
            element.focus();
        }
    }

    isKeyboardNavigation() {
        return this.keyboardNavigation;
    }

    isHighContrast() {
        return this.highContrast;
    }

    isReducedMotion() {
        return this.reducedMotion;
    }
}

// Initialize accessibility features when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.accessibilityManager = new AccessibilityManager();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AccessibilityManager;
}
