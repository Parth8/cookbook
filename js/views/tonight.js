// Stub views for Tonight, Fridge, Planner, Host, Cook Mode

export function renderTonight(container) {
    container.innerHTML = `
        <div class="view-tonight">
            <h1>Tonight</h1>
            <p class="view-description">Context-first recipe picker - what fits today?</p>
            <p class="text-margin">Coming soon: Three optional questions (time? mood? protein?) → deal one full-screen pick</p>
        </div>
    `;
}
