// Cook Mode - full screen, step-by-step

let currentStep = 0;
let currentRecipeId = null;
let wakeLock = null;

export function renderCookMode(container, recipeId) {
    const { recipes } = window.cookbook;
    const recipe = recipes.find(r => r.id === recipeId);
    
    if (!recipe) {
        container.innerHTML = '<div class="error">Recipe not found</div>';
        return;
    }
    
    // Step position belongs to one recipe - reset when a different card enters cook mode
    if (recipeId !== currentRecipeId) {
        currentStep = 0;
        currentRecipeId = recipeId;
    }
    // Defensive clamp in case steps changed under us
    currentStep = Math.min(currentStep, recipe.steps.length - 1);
    
    // A rerender replaces the timer display node - stop any ticking timer
    clearActiveTimer();
    
    const step = recipe.steps[currentStep];
    const isFirst = currentStep === 0;
    const isLast = currentStep === recipe.steps.length - 1;
    
    container.innerHTML = `
        <div class="cook-mode">
            <div class="cook-header">
                <a href="#/recipe/${recipe.id}" class="cook-exit">✕ Exit</a>
                <div class="cook-progress text-mono">
                    Step ${currentStep + 1} of ${recipe.steps.length}
                </div>
            </div>
            
            <div class="cook-content">
                <h2 class="cook-step-title">${step.title}</h2>
                <p class="cook-step-text">${step.text}</p>
                
                ${step.timer_s > 0 ? `
                    <div class="cook-timer">
                        <div class="timer-display text-mono">${formatTime(step.timer_s)}</div>
                        <button class="timer-start-btn">Start Timer</button>
                    </div>
                ` : ''}
                
                ${step.cue ? `
                    <div class="cook-cue text-margin">
                        ${step.cue}
                    </div>
                ` : ''}
            </div>
            
            <div class="cook-nav">
                <button class="cook-nav-btn" ${isFirst ? 'disabled' : ''} data-dir="prev">
                    ← Previous
                </button>
                <button class="cook-nav-btn" ${isLast ? 'disabled' : ''} data-dir="next">
                    Next →
                </button>
            </div>
        </div>
    `;
    
    attachCookHandlers(container, recipe);
    requestWakeLock();
}

// Release the wake lock and clear timers whenever the route leaves cook mode,
// however the user got out (exit link, tab bar, browser back)
window.addEventListener('hashchange', () => {
    if (!window.location.hash.startsWith('#/cook/')) {
        releaseWakeLock();
        clearActiveTimer();
        currentStep = 0;
        currentRecipeId = null;
    }
});

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${minutes}:${secs.toString().padStart(2, '0')}` : `${minutes} min`;
}

function attachCookHandlers(container, recipe) {
    // Navigation
    container.querySelectorAll('.cook-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const dir = btn.dataset.dir;
            if (dir === 'next' && currentStep < recipe.steps.length - 1) {
                currentStep++;
                renderCookMode(container, recipe.id);
            } else if (dir === 'prev' && currentStep > 0) {
                currentStep--;
                renderCookMode(container, recipe.id);
            }
        });
    });
    
    // Timer (basic implementation)
    const timerBtn = container.querySelector('.timer-start-btn');
    if (timerBtn) {
        timerBtn.addEventListener('click', () => {
            const step = recipe.steps[currentStep];
            startTimer(step.timer_s, container);
        });
    }
    
    // Exit releases wake lock
    container.querySelector('.cook-exit')?.addEventListener('click', () => {
        releaseWakeLock();
        clearActiveTimer();
        currentStep = 0;
        currentRecipeId = null;
    });
}

let activeTimerInterval = null;

function clearActiveTimer() {
    if (activeTimerInterval) {
        clearInterval(activeTimerInterval);
        activeTimerInterval = null;
    }
}

function startTimer(seconds, container) {
    const display = container.querySelector('.timer-display');
    const btn = container.querySelector('.timer-start-btn');
    
    clearActiveTimer();
    
    let remaining = seconds;
    btn.textContent = 'Running...';
    btn.disabled = true;
    
    const interval = setInterval(() => {
        remaining--;
        display.textContent = formatTime(remaining);
        
        if (remaining <= 0) {
            clearInterval(interval);
            activeTimerInterval = null;
            btn.textContent = 'Done!';
            display.style.color = 'var(--color-primary)';
            
            // Play notification (if browser supports)
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('Timer done!');
            }
        }
    }, 1000);
    
    activeTimerInterval = interval;
}

async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log('✓ Wake lock active');
        } catch (err) {
            console.warn('Wake lock failed:', err);
        }
    }
}

function releaseWakeLock() {
    if (wakeLock) {
        wakeLock.release();
        wakeLock = null;
        console.log('✓ Wake lock released');
    }
}
