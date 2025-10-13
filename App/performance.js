/**
 * Performance Optimization Module for Sinhala Sign Language LMS
 * Implements lazy loading, caching, and performance monitoring
 */

class PerformanceManager {
    constructor() {
        this.isInitialized = false;
        this.cache = new Map();
        this.observers = new Map();
        this.metrics = {
            loadTime: 0,
            renderTime: 0,
            interactionTime: 0
        };
        
        this.init();
    }

    init() {
        if (this.isInitialized) return;
        
        this.setupLazyLoading();
        this.setupImageOptimization();
        this.setupResourcePreloading();
        this.setupCaching();
        this.setupPerformanceMonitoring();
        this.setupWebSocketOptimization();
        this.setupMemoryManagement();
        
        this.isInitialized = true;
        console.log('✓ Performance optimizations initialized');
    }

    // Lazy Loading
    setupLazyLoading() {
        // Lazy load images
        this.setupImageLazyLoading();
        
        // Lazy load components
        this.setupComponentLazyLoading();
        
        // Lazy load scripts
        this.setupScriptLazyLoading();
    }

    setupImageLazyLoading() {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        this.loadImage(img);
                        imageObserver.unobserve(img);
                    }
                });
            }, {
                rootMargin: '50px 0px',
                threshold: 0.01
            });

            // Observe all images with data-src
            document.querySelectorAll('img[data-src]').forEach(img => {
                imageObserver.observe(img);
            });

            this.observers.set('images', imageObserver);
        }
    }

    loadImage(img) {
        const src = img.dataset.src;
        if (src) {
            img.src = src;
            img.removeAttribute('data-src');
            img.classList.add('loaded');
        }
    }

    setupComponentLazyLoading() {
        // Lazy load dashboard components
        const dashboardObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.loadDashboardComponent(entry.target);
                    dashboardObserver.unobserve(entry.target);
                }
            });
        });

        document.querySelectorAll('[data-lazy-component]').forEach(component => {
            dashboardObserver.observe(component);
        });

        this.observers.set('components', dashboardObserver);
    }

    loadDashboardComponent(component) {
        const componentType = component.dataset.lazyComponent;
        
        switch (componentType) {
            case 'stats':
                this.loadStatsComponent(component);
                break;
            case 'achievements':
                this.loadAchievementsComponent(component);
                break;
            case 'activity':
                this.loadActivityComponent(component);
                break;
        }
    }

    loadStatsComponent(container) {
        // Simulate loading stats data
        setTimeout(() => {
            container.innerHTML = `
                <div class="stat-card">
                    <div class="stat-value">87%</div>
                    <div class="stat-label">Accuracy</div>
                </div>
            `;
            container.classList.add('loaded');
        }, 100);
    }

    loadAchievementsComponent(container) {
        // Simulate loading achievements
        setTimeout(() => {
            container.innerHTML = `
                <div class="achievement-card earned">
                    <div class="achievement-icon">🏆</div>
                    <h5 class="achievement-title">First Steps</h5>
                    <p class="achievement-description">Complete your first practice session</p>
                </div>
            `;
            container.classList.add('loaded');
        }, 150);
    }

    loadActivityComponent(container) {
        // Simulate loading activity data
        setTimeout(() => {
            container.innerHTML = `
                <div class="activity-item">
                    <div class="activity-icon practice">🎯</div>
                    <div class="activity-content">
                        <div class="activity-title">Completed letter "අ" practice</div>
                        <div class="activity-description">3/3 attempts successful</div>
                    </div>
                    <div class="activity-time">2 hours ago</div>
                </div>
            `;
            container.classList.add('loaded');
        }, 200);
    }

    setupScriptLazyLoading() {
        // Lazy load non-critical scripts
        const scripts = [
            { src: 'accessibility.js', condition: () => true },
            { src: 'analytics.js', condition: () => !this.isLocalhost() }
        ];

        scripts.forEach(script => {
            if (script.condition()) {
                this.loadScript(script.src);
            }
        });
    }

    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // Image Optimization
    setupImageOptimization() {
        this.optimizeImages();
        this.setupResponsiveImages();
    }

    optimizeImages() {
        // Add loading="lazy" to images
        document.querySelectorAll('img:not([loading])').forEach(img => {
            img.loading = 'lazy';
        });

        // Add proper alt attributes
        document.querySelectorAll('img:not([alt])').forEach(img => {
            img.alt = 'Image';
        });
    }

    setupResponsiveImages() {
        // Convert images to responsive format
        document.querySelectorAll('img[data-responsive]').forEach(img => {
            const srcset = img.dataset.srcset;
            if (srcset) {
                img.srcset = srcset;
                img.sizes = img.dataset.sizes || '100vw';
            }
        });
    }

    // Resource Preloading
    setupResourcePreloading() {
        this.preloadCriticalResources();
        this.preloadNextPageResources();
    }

    preloadCriticalResources() {
        // Preload critical CSS
        this.preloadResource('design-system.css', 'style');
        
        // Preload critical fonts
        this.preloadResource('https://fonts.googleapis.com/css2?family=Noto+Sans+Sinhala:wght@400;700&display=swap', 'style');
        
        // Preload critical images
        this.preloadResource('images/placeholder.jpg', 'image');
    }

    preloadNextPageResources() {
        // Preload next page resources based on user behavior
        this.setupPredictivePreloading();
    }

    setupPredictivePreloading() {
        // Track user interactions to predict next page
        const links = document.querySelectorAll('a[href]');
        links.forEach(link => {
            link.addEventListener('mouseenter', () => {
                this.preloadPage(link.href);
            });
        });
    }

    preloadPage(url) {
        if (this.cache.has(url)) return;
        
        // Preload page resources
        fetch(url, { method: 'HEAD' })
            .then(response => {
                if (response.ok) {
                    this.cache.set(url, true);
                }
            })
            .catch(() => {
                // Ignore errors
            });
    }

    preloadResource(href, as) {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = href;
        link.as = as;
        document.head.appendChild(link);
    }

    // Caching
    setupCaching() {
        this.setupMemoryCache();
        this.setupLocalStorageCache();
    }

    setupMemoryCache() {
        // Cache frequently accessed DOM elements
        this.cacheDOMElements();
        
        // Cache API responses
        this.setupAPICaching();
    }

    cacheDOMElements() {
        const elements = {
            webcam: document.getElementById('webcam'),
            predictionText: document.getElementById('prediction-text'),
            currentLetter: document.getElementById('current-letter'),
            feedbackBox: document.getElementById('feedback-box')
        };

        Object.entries(elements).forEach(([key, element]) => {
            if (element) {
                this.cache.set(key, element);
            }
        });
    }

    setupAPICaching() {
        // Cache model predictions
        const originalFetch = window.fetch;
        window.fetch = async (url, options) => {
            const cacheKey = `${url}-${JSON.stringify(options)}`;
            
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }
            
            const response = await originalFetch(url, options);
            this.cache.set(cacheKey, response);
            return response;
        };
    }

    setupLocalStorageCache() {
        // Cache user preferences
        this.cacheUserPreferences();
        
        // Cache progress data
        this.cacheProgressData();
    }

    cacheUserPreferences() {
        const preferences = {
            theme: localStorage.getItem('theme') || 'light',
            language: localStorage.getItem('language') || 'si',
            accessibility: JSON.parse(localStorage.getItem('accessibility-preferences') || '{}')
        };
        
        this.cache.set('preferences', preferences);
    }

    cacheProgressData() {
        const progress = JSON.parse(localStorage.getItem('practice-progress') || '{}');
        this.cache.set('progress', progress);
    }

    // Performance Monitoring
    setupPerformanceMonitoring() {
        this.monitorLoadPerformance();
        this.monitorRenderPerformance();
        this.monitorInteractionPerformance();
        this.setupPerformanceBudget();
    }

    monitorLoadPerformance() {
        window.addEventListener('load', () => {
            const navigation = performance.getEntriesByType('navigation')[0];
            this.metrics.loadTime = navigation.loadEventEnd - navigation.loadEventStart;
            
            console.log(`Page load time: ${this.metrics.loadTime}ms`);
        });
    }

    monitorRenderPerformance() {
        const observer = new PerformanceObserver((list) => {
            list.getEntries().forEach(entry => {
                if (entry.entryType === 'measure') {
                    this.metrics.renderTime = entry.duration;
                    console.log(`Render time: ${entry.duration}ms`);
                }
            });
        });
        
        observer.observe({ entryTypes: ['measure'] });
    }

    monitorInteractionPerformance() {
        // Monitor click performance
        document.addEventListener('click', (e) => {
            const start = performance.now();
            
            requestAnimationFrame(() => {
                const end = performance.now();
                this.metrics.interactionTime = end - start;
                
                if (this.metrics.interactionTime > 100) {
                    console.warn(`Slow interaction: ${this.metrics.interactionTime}ms`);
                }
            });
        });
    }

    setupPerformanceBudget() {
        const budget = {
            loadTime: 3000, // 3 seconds
            renderTime: 100, // 100ms
            interactionTime: 50 // 50ms
        };

        // Check performance budget
        setInterval(() => {
            if (this.metrics.loadTime > budget.loadTime) {
                console.warn('Load time exceeds budget');
            }
            if (this.metrics.renderTime > budget.renderTime) {
                console.warn('Render time exceeds budget');
            }
            if (this.metrics.interactionTime > budget.interactionTime) {
                console.warn('Interaction time exceeds budget');
            }
        }, 5000);
    }

    // WebSocket Optimization
    setupWebSocketOptimization() {
        this.optimizeWebSocketConnection();
        this.setupWebSocketReconnection();
    }

    optimizeWebSocketConnection() {
        // Throttle WebSocket messages
        this.throttleWebSocketMessages();
        
        // Compress WebSocket data
        this.compressWebSocketData();
    }

    throttleWebSocketMessages() {
        let lastMessageTime = 0;
        const throttleDelay = 100; // 100ms

        const originalSend = WebSocket.prototype.send;
        WebSocket.prototype.send = function(data) {
            const now = Date.now();
            if (now - lastMessageTime > throttleDelay) {
                originalSend.call(this, data);
                lastMessageTime = now;
            }
        };
    }

    compressWebSocketData() {
        // Use compression for large data
        const originalSend = WebSocket.prototype.send;
        WebSocket.prototype.send = function(data) {
            if (data instanceof ArrayBuffer && data.byteLength > 1024) {
                // Compress large data
                const compressed = this.compressData(data);
                originalSend.call(this, compressed);
            } else {
                originalSend.call(this, data);
            }
        };
    }

    compressData(data) {
        // Simple compression using pako or similar library
        // For now, return original data
        return data;
    }

    setupWebSocketReconnection() {
        // Implement exponential backoff for reconnection
        let reconnectAttempts = 0;
        const maxReconnectAttempts = 5;
        const baseDelay = 1000;

        const reconnect = () => {
            if (reconnectAttempts < maxReconnectAttempts) {
                const delay = baseDelay * Math.pow(2, reconnectAttempts);
                setTimeout(() => {
                    reconnectAttempts++;
                    // Attempt to reconnect
                    this.attemptReconnection();
                }, delay);
            }
        };

        // Store reconnection function for use in WebSocket error handlers
        this.reconnect = reconnect;
    }

    attemptReconnection() {
        // Implementation would depend on your WebSocket setup
        console.log('Attempting WebSocket reconnection...');
    }

    // Memory Management
    setupMemoryManagement() {
        this.setupMemoryCleanup();
        this.monitorMemoryUsage();
    }

    setupMemoryCleanup() {
        // Clean up unused observers
        this.cleanupObservers();
        
        // Clean up unused cache entries
        this.cleanupCache();
        
        // Clean up unused event listeners
        this.cleanupEventListeners();
    }

    cleanupObservers() {
        // Clean up intersection observers when components are removed
        document.addEventListener('DOMNodeRemoved', (e) => {
            const target = e.target;
            this.observers.forEach((observer, key) => {
                if (target.matches(`[data-lazy-component="${key}"]`)) {
                    observer.disconnect();
                    this.observers.delete(key);
                }
            });
        });
    }

    cleanupCache() {
        // Limit cache size
        const maxCacheSize = 100;
        if (this.cache.size > maxCacheSize) {
            const entries = Array.from(this.cache.entries());
            const toDelete = entries.slice(0, entries.length - maxCacheSize);
            toDelete.forEach(([key]) => this.cache.delete(key));
        }
    }

    cleanupEventListeners() {
        // Remove event listeners when elements are removed
        document.addEventListener('DOMNodeRemoved', (e) => {
            const target = e.target;
            if (target.removeEventListener) {
                // Remove all event listeners
                target.removeEventListener = () => {};
            }
        });
    }

    monitorMemoryUsage() {
        if ('memory' in performance) {
            setInterval(() => {
                const memory = performance.memory;
                const usedMB = memory.usedJSHeapSize / 1048576;
                const totalMB = memory.totalJSHeapSize / 1048576;
                
                if (usedMB > 50) { // 50MB threshold
                    console.warn(`High memory usage: ${usedMB.toFixed(2)}MB`);
                    this.triggerMemoryCleanup();
                }
            }, 10000); // Check every 10 seconds
        }
    }

    triggerMemoryCleanup() {
        // Force garbage collection if available
        if (window.gc) {
            window.gc();
        }
        
        // Clear cache
        this.cache.clear();
        
        // Reinitialize cache
        this.setupCaching();
    }

    // Utility Methods
    isLocalhost() {
        return window.location.hostname === 'localhost' || 
               window.location.hostname === '127.0.0.1';
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // Public API
    getMetrics() {
        return { ...this.metrics };
    }

    clearCache() {
        this.cache.clear();
    }

    preloadResource(href, as) {
        this.preloadResource(href, as);
    }

    optimizeImage(img) {
        this.optimizeImages();
    }
}

// Initialize performance optimizations when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.performanceManager = new PerformanceManager();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerformanceManager;
}
