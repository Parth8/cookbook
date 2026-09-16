// Cook Mode - full screen, step-by-step.
// Drinks get the same player; the copy just calls it pouring.

let currentStep = 0;
let currentRecipeId = null;
let wakeLock = null;
let activeTimer = null;          // { id, remaining, total, paused }
let mounted = null;              // { container, recipe } while cook mode is on screen

export function renderCookMode(container, recipeId) {
    const { recipes } = window.cookbook;
    const recipe = recipes.find(r => r.id === recipeId);

    if (!recipe) {
        container.innerHTML = `<div class="cook-mode"><p class="empty-state">Recipe not found.</p><a href="#/" class="btn btn-ghost">Back to menu</a></div>`;
        return;
    }
    const steps = recipe.steps || [];
    if (!steps.length) {
        container.innerHTML = `<div class="cook-mode"><p class="empty-state">This card has no steps yet.</p><a href="#/recipe/${recipe.id}" class="btn btn-ghost">Back</a></div>`;
        return;
    }

    // Step position belongs to one recipe - reset when a different card enters cook mode
    if (recipeId !== currentRecipeId) {
        currentStep = 0;
        currentRecipeId = recipeId;
    }
    currentStep = Math.min(Math.max(currentStep, 0), steps.length - 1);

    // A rerender replaces the timer display node - stop any ticking timer
    clearActiveTimer();
    mounted = { container, recipe };

    const step = steps[currentStep];
    const isFirst = currentStep === 0;
    const isLast = currentStep === steps.length - 1;
    const isDrink = (recipe.tags.meal || []).includes('drink');
    const pct = ((currentStep + 1) / steps.length) * 100;

    container.innerHTML = `
        <div class="cook-mode">
            <div class="cook-header">
                <a href="#/recipe/${recipe.id}" class="cook-exit">✕ Exit</a>
                <div class="cook-progress text-mono">
                    ${isDrink ? 'Pour' : 'Step'} ${currentStep + 1} of ${steps.length}
                </div>
            </div>

            <div class="cook-rail" role="progressbar" aria-valuemin="1"
                 aria-valuemax="${steps.length}" aria-valuenow="${currentStep + 1}">
                <div class="cook-rail-fill" style="width:${pct}%"></div>
            </div>

            <div class="cook-content">
                <h2 class="cook-step-title">${step.title}</h2>
                <p class="cook-step-text">${step.text}</p>

                ${step.timer_s > 0 ? `
                    <div class="cook-timer">
                        <div class="timer-display text-mono">${formatTime(step.timer_s)}</div>
                        <button class="timer-start-btn" data-action="start">Start timer</button>
                        <button class="timer-reset-btn" hidden>Reset</button>
                    </div>
                ` : ''}

                ${step.cue ? `<div class="cook-cue text-margin">${step.cue}</div>` : ''}
            </div>

            <div class="cook-nav">
                <button class="cook-nav-btn" ${isFirst ? 'disabled' : ''} data-dir="prev">← Previous</button>
                ${isLast
                    ? `<a class="cook-nav-btn cook-done" href="#/recipe/${recipe.id}">Done ✓</a>`
                    : '<button class="cook-nav-btn" data-dir="next">Next →</button>'}
            </div>

            <p class="cook-hint text-margin">Arrow keys or swipe to move between steps</p>
        </div>
    `;

    attachCookHandlers(container, recipe);
    requestWakeLock();
}

function go(delta) {
    if (!mounted) return;
    const steps = mounted.recipe.steps;
    const next = currentStep + delta;
    if (next < 0 || next > steps.length - 1) return;
    currentStep = next;
    renderCookMode(mounted.container, mounted.recipe.id);
}

function leaveCookMode() {
    releaseWakeLock();
    clearActiveTimer();
    currentStep = 0;
    currentRecipeId = null;
    mounted = null;
}

// Release the wake lock and clear timers whenever the route leaves cook mode,
// however the user got out (exit link, tab bar, browser back)
window.addEventListener('hashchange', () => {
    if (!window.location.hash.startsWith('#/cook/')) leaveCookMode();
});

// Keyboard nav lives at the document, bound once, and no-ops off-route.
// Re-binding it per render would stack a listener on every step change.
document.addEventListener('keydown', e => {
    if (!mounted || !location.hash.startsWith('#/cook/')) return;
    if (e.target.matches('input, textarea')) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); go(-1); }
    else if (e.key === 'Escape') location.hash = `#/recipe/${mounted.recipe.id}`;
});

function formatTime(seconds) {
    const s = Math.max(0, Math.round(seconds));
    const minutes = Math.floor(s / 60);
    const secs = s % 60;
    return `${minutes}:${String(secs).padStart(2, '0')}`;
}

function attachCookHandlers(container, recipe) {
    container.querySelectorAll('.cook-nav-btn[data-dir]').forEach(btn => {
        btn.addEventListener('click', () => go(btn.dataset.dir === 'next' ? 1 : -1));
    });

    const timerBtn = container.querySelector('.timer-start-btn');
    const resetBtn = container.querySelector('.timer-reset-btn');
    if (timerBtn) {
        timerBtn.addEventListener('click', () => {
            const step = recipe.steps[currentStep];
            if (!activeTimer) startTimer(step.timer_s, container);
            else togglePause(container);
        });
    }
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            clearActiveTimer();
            const step = recipe.steps[currentStep];
            const display = container.querySelector('.timer-display');
            if (display) { display.textContent = formatTime(step.timer_s); display.style.color = ''; }
            timerBtn.textContent = 'Start timer';
            timerBtn.disabled = false;
            resetBtn.hidden = true;
        });
    }

    container.querySelector('.cook-exit')?.addEventListener('click', leaveCookMode);

    // Swipe between steps on touch. Horizontal intent only, so a vertical
    // scroll through a long step never flips the page.
    const surface = container.querySelector('.cook-mode');
    let x0 = null, y0 = null;
    surface?.addEventListener('touchstart', e => {
        x0 = e.changedTouches[0].clientX;
        y0 = e.changedTouches[0].clientY;
    }, { passive: true });
    surface?.addEventListener('touchend', e => {
        if (x0 === null) return;
        const dx = e.changedTouches[0].clientX - x0;
        const dy = e.changedTouches[0].clientY - y0;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
        x0 = y0 = null;
    }, { passive: true });
}

function clearActiveTimer() {
    if (activeTimer) {
        clearInterval(activeTimer.id);
        activeTimer = null;
    }
}

function togglePause(container) {
    if (!activeTimer) return;
    const btn = container.querySelector('.timer-start-btn');
    activeTimer.paused = !activeTimer.paused;
    btn.textContent = activeTimer.paused ? 'Resume' : 'Pause';
}

function startTimer(seconds, container) {
    const display = container.querySelector('.timer-display');
    const btn = container.querySelector('.timer-start-btn');
    const resetBtn = container.querySelector('.timer-reset-btn');

    clearActiveTimer();
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
    }

    activeTimer = { id: null, remaining: seconds, total: seconds, paused: false };
    btn.textContent = 'Pause';
    if (resetBtn) resetBtn.hidden = false;

    activeTimer.id = setInterval(() => {
        if (activeTimer.paused) return;
        activeTimer.remaining--;
        display.textContent = formatTime(activeTimer.remaining);

        if (activeTimer.remaining <= 0) {
            clearActiveTimer();
            btn.textContent = 'Done!';
            btn.disabled = true;
            display.style.color = 'var(--accent)';
            notifyDone();
        }
    }, 1000);
}

function notifyDone() {
    if ('Notification' in window && Notification.permission === 'granted') {
        try { new Notification('Timer done!'); } catch {}
    }
    if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
    beep();
}

// Three short tones from the WebAudio oscillator - no asset to ship or 404.
function beep() {
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        [0, 0.28, 0.56].forEach(offset => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
            gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + offset + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.2);
            osc.start(ctx.currentTime + offset);
            osc.stop(ctx.currentTime + offset + 0.22);
        });
        setTimeout(() => ctx.close().catch(() => {}), 1200);
    } catch {}
}

async function requestWakeLock() {
    if (!('wakeLock' in navigator) || wakeLock) return;
    try {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener?.('release', () => { wakeLock = null; });
    } catch {
        // Denied or unsupported - cook mode still works, the screen just sleeps.
    }
}

function releaseWakeLock() {
    if (wakeLock) {
        wakeLock.release().catch(() => {});
        wakeLock = null;
    }
}
