// Fridge matcher view

import { matchRecipesToFridge, getPerishableIngredients, formatMatchLine } from '../lib/match.js';

let selectedIngredients = [];
let query = '';

export function renderFridge(container) {
    container.innerHTML = `
        <div class="view-fridge">
            <div class="view-head">
                <h1>Fridge</h1>
                <p class="view-description">Tap what you actually have. The ranking is honest set maths, not vibes.</p>
            </div>

            <div class="fridge-controls">
                <input type="search" class="fridge-search" placeholder="Find an ingredient"
                       autocomplete="off" spellcheck="false" value="${escapeAttr(query)}">
                <button class="btn btn-ghost fridge-clear" ${selectedIngredients.length ? '' : 'hidden'}>Clear</button>
                <span class="filter-count fridge-count"></span>
            </div>

            <div class="fridge-grid"></div>
            <div class="match-results"></div>
        </div>`;

    drawChips(container);
    drawMatches(container);
    wire(container);
}

function drawChips(container) {
    const { ingredients } = window.cookbook;
    const perishables = getPerishableIngredients(ingredients);
    const q = query.trim().toLowerCase();

    // Selected chips always stay on screen, even when the search filters them
    // out - otherwise typing makes your own choices vanish.
    const shown = perishables.filter(i =>
        selectedIngredients.includes(i.ref) || !q || i.name.toLowerCase().includes(q)
    );

    const grid = container.querySelector('.fridge-grid');
    grid.innerHTML = shown.length
        ? shown.map(ing => `
            <button class="fridge-chip tap-target"
                    data-ref="${ing.ref}"
                    aria-pressed="${selectedIngredients.includes(ing.ref)}"
                    data-selected="${selectedIngredients.includes(ing.ref)}">
                ${ing.name}
            </button>`).join('')
        : '<p class="search-empty">Nothing in the list matches that.</p>';

    const n = selectedIngredients.length;
    container.querySelector('.fridge-count').textContent =
        n ? `${n} selected` : `${perishables.length} ingredients`;
    container.querySelector('.fridge-clear').hidden = n === 0;
}

function drawMatches(container) {
    const { recipes } = window.cookbook;
    const results = container.querySelector('.match-results');

    if (!selectedIngredients.length) {
        results.innerHTML = '<p class="empty-state">Pick a few things to see what they add up to.</p>';
        return;
    }

    const matches = matchRecipesToFridge(recipes, selectedIngredients);
    if (!matches.length) {
        results.innerHTML = '<p class="empty-state">Nothing uses that combination. Try one more staple.</p>';
        return;
    }

    results.innerHTML = `
        <h2 class="fridge-heading">${matches.length} dish${matches.length === 1 ? '' : 'es'} use what you have</h2>
        ${matches.slice(0, 40).map(match => `
            <a href="#/recipe/${match.recipe.id}" class="match-card">
                <span class="match-name">
                    <span class="veg-indicator" data-veg="${match.recipe.veg}"></span>
                    ${match.recipe.name}
                </span>
                <span class="match-detail">
                    <span class="match-line text-mono">${formatMatchLine(match, selectedIngredients.length)}</span>
                    <span class="match-meta text-mono">${match.recipe.macros.kcal} kcal · ${match.recipe.macros.protein_g}g protein · ${match.recipe.time.active_min} min</span>
                </span>
            </a>`).join('')}`;
}

function wire(container) {
    // Delegated, so redrawing the chip grid never needs re-wiring — and the
    // page no longer rebuilds itself (and jumps to the top) on every tap.
    container.querySelector('.fridge-grid').addEventListener('click', e => {
        const chip = e.target.closest('.fridge-chip');
        if (!chip) return;
        const ref = chip.dataset.ref;
        const i = selectedIngredients.indexOf(ref);
        if (i === -1) selectedIngredients.push(ref); else selectedIngredients.splice(i, 1);

        const on = i === -1;
        chip.dataset.selected = String(on);
        chip.setAttribute('aria-pressed', String(on));

        const n = selectedIngredients.length;
        container.querySelector('.fridge-count').textContent =
            n ? `${n} selected` : `${getPerishableIngredients(window.cookbook.ingredients).length} ingredients`;
        container.querySelector('.fridge-clear').hidden = n === 0;
        drawMatches(container);
    });

    const search = container.querySelector('.fridge-search');
    search.addEventListener('input', e => {
        query = e.target.value;
        drawChips(container);
    });

    container.querySelector('.fridge-clear').addEventListener('click', () => {
        selectedIngredients = [];
        drawChips(container);
        drawMatches(container);
    });
}

function escapeAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
