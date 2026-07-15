// Recipe detail view

import { getProteinDensity, getCostBandLabel, scaleRecipe } from '../lib/macros.js';

let currentScale = 1;
let lastRecipeId = null;

export function renderRecipe(container, recipeId, accordion = null) {
    const { recipes, ingredients } = window.cookbook;
    const recipe = recipes.find(r => r.id === recipeId);
    
    if (!recipe) {
        container.innerHTML = '<div class="error">Recipe not found</div>';
        return;
    }
    
    // Scale is per-recipe, not global - reset when navigating to a new card
    if (recipeId !== lastRecipeId) {
        currentScale = 1;
        lastRecipeId = recipeId;
    }
    
    const scaled = scaleRecipe(recipe, currentScale);
    const isDrink = (recipe.tags.meal || []).includes('drink');
    
    container.innerHTML = `
        <div class="recipe-view">
            <div class="recipe-header">
                <div class="recipe-meta">
                    <span class="recipe-number text-mono">${recipe.no ? `No. ${recipe.no}` : 'Side'}</span>
                    <span class="veg-indicator" data-veg="${recipe.veg}"></span>
                    ${recipe.core ? '<span class="core-badge">● Core</span>' : ''}
                </div>
                <h1 class="recipe-title">${recipe.name}</h1>
                <p class="recipe-tagline">${recipe.tagline}</p>
                ${recipe.aka?.length ? `
                    <p class="recipe-aka">Also answers to: ${recipe.aka.join(' · ')}</p>
                ` : ''}
            </div>
            
            <div class="recipe-decide-zone">
                ${renderMacroStrip(scaled.macros, isDrink)}
                ${renderEffortBar(recipe)}
                ${renderTagChips(recipe)}
            </div>
            
            ${renderLore(recipe)}
            ${renderVariants(recipe)}
            
            ${renderAccordions(scaled, recipe, ingredients, accordion)}
            
            <div class="recipe-actions">
                <a href="#/cook/${recipe.id}" class="btn btn-primary">
                    ${isDrink ? 'Start Pour Mode' : 'Start Cook Mode'}
                </a>
            </div>
        </div>
    `;
    
    attachRecipeHandlers(container, recipe);
    
    // Open specific accordion if provided
    if (accordion) {
        const acc = container.querySelector(`[data-accordion="${accordion}"]`);
        if (acc) {
            acc.dataset.open = 'true';
        }
    }
}

function renderMacroStrip(macros, isDrink = false) {
    const hasAlcohol = (macros.alcohol_g || 0) > 0;
    
    // Last tile: protein density for food, alcohol load for drinks
    // (10g ethanol = 1 standard drink, the WHO yardstick)
    const lastTile = hasAlcohol
        ? `
            <div class="macro-item">
                <div class="macro-value text-mono">${Math.round((macros.alcohol_g / 10) * 10) / 10}</div>
                <div class="macro-label">standard drinks</div>
            </div>
        `
        : `
            <div class="macro-item">
                <div class="macro-value text-mono">${getProteinDensity(macros)}</div>
                <div class="macro-label">g protein / 100 kcal</div>
            </div>
        `;
    
    return `
        <div class="macro-strip">
            <div class="macro-item">
                <div class="macro-value text-mono">${macros.kcal}</div>
                <div class="macro-label">calories</div>
            </div>
            <div class="macro-item ${isDrink ? '' : 'macro-highlight'}">
                <div class="macro-value text-mono">${macros.protein_g}g</div>
                <div class="macro-label">protein</div>
            </div>
            <div class="macro-item">
                <div class="macro-value text-mono">${macros.carbs_g}g</div>
                <div class="macro-label">carbs</div>
            </div>
            ${hasAlcohol ? `
                <div class="macro-item macro-highlight">
                    <div class="macro-value text-mono">${macros.alcohol_g}g</div>
                    <div class="macro-label">alcohol (7 kcal/g)</div>
                </div>
            ` : `
                <div class="macro-item">
                    <div class="macro-value text-mono">${macros.fat_g}g</div>
                    <div class="macro-label">fat</div>
                </div>
            `}
            ${lastTile}
        </div>
    `;
}

function renderLore(recipe) {
    if (!recipe.lore || recipe.lore.length === 0) return '';
    
    return `
        <div class="lore-block">
            <div class="lore-heading">Worth knowing</div>
            ${recipe.lore.map(note => `
                <p class="lore-note text-margin">${note}</p>
            `).join('')}
        </div>
    `;
}

function renderVariants(recipe) {
    if (!recipe.variants || recipe.variants.length === 0) return '';
    
    return `
        <div class="variants-block">
            <div class="variants-heading">Variants</div>
            ${recipe.variants.map(v => `
                <div class="variant-item">
                    <span class="variant-name">${v.name}</span>
                    <span class="variant-swaps">${v.swaps}</span>
                    <span class="variant-macros text-mono">${v.macros.kcal} kcal · ${v.macros.protein_g}g protein</span>
                </div>
            `).join('')}
        </div>
    `;
}

function renderEffortBar(recipe) {
    return `
        <div class="effort-bar">
            <div class="effort-item">
                <strong>${recipe.time.active_min} min</strong> active
            </div>
            <div class="effort-item">
                <strong>${recipe.time.passive_min} min</strong> passive
            </div>
            <div class="effort-item">
                <strong>${recipe.cleanup.vessels}</strong> vessel cleanup
            </div>
            <div class="effort-item">
                <strong>${getCostBandLabel(recipe.cost_band)}</strong> cost
            </div>
            ${recipe.spice ? `
                <div class="effort-item">
                    <strong>${'🌶️'.repeat(recipe.spice.level)}</strong> spice
                </div>
            ` : ''}
        </div>
    `;
}

function renderTagChips(recipe) {
    const chips = [];
    Object.entries(recipe.tags).forEach(([facet, values]) => {
        values.forEach(value => {
            chips.push(`
                <span class="chip chip-small" data-facet="${facet}">
                    ${formatTagValue(value)}
                </span>
            `);
        });
    });
    
    return `<div class="tag-chips">${chips.join('')}</div>`;
}

function formatTagValue(value) {
    return value.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}

function renderAccordions(scaled, original, ingredientsDb, openAccordion) {
    return `
        <div class="accordions">
            ${renderShopAccordion(scaled, original, ingredientsDb, openAccordion === 'shop')}
            ${renderCookAccordion(scaled, openAccordion === 'cook')}
            ${renderAfterAccordion(original, openAccordion === 'after')}
            ${renderRelatedAccordion(original, openAccordion === 'related')}
            ${original.host ? renderHostAccordion(original, openAccordion === 'host') : ''}
        </div>
    `;
}

function renderRelatedAccordion(recipe, open) {
    const { recipes, graph } = window.cookbook;
    const rel = graph?.[recipe.id];
    if (!rel) return '';
    
    const resolve = (ids) => ids
        .map(id => recipes.find(r => r.id === id))
        .filter(Boolean);
    
    const groups = [
        { label: 'Pairs with', items: resolve(rel.pairs_with) },
        { label: 'In the same spirit', items: resolve(rel.similar_to) },
        { label: 'Pour alongside', items: resolve(rel.drink) }
    ].filter(g => g.items.length > 0);
    
    const wantedBy = (rel.wanted_by || [])
        .map(w => ({ ...w, recipe: recipes.find(r => r.id === w.from) }))
        .filter(w => w.recipe);
    
    if (groups.length === 0 && wantedBy.length === 0) return '';
    
    return `
        <div class="accordion" data-accordion="related" data-open="${open}">
            <button class="accordion-trigger">
                <span>Related</span>
                <span class="accordion-icon">▼</span>
            </button>
            <div class="accordion-content">
                ${groups.map(group => `
                    <div class="related-group">
                        <h4>${group.label}</h4>
                        <div class="related-links">
                            ${group.items.map(r => `
                                <a href="#/recipe/${r.id}" class="related-link">
                                    <span class="veg-indicator" data-veg="${r.veg}"></span>
                                    ${r.name}
                                    <span class="related-kcal text-mono">${r.macros.kcal} kcal</span>
                                </a>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
                ${wantedBy.length > 0 ? `
                    <div class="related-group">
                        <h4>Feeds on leftovers from</h4>
                        <div class="related-links">
                            ${wantedBy.map(w => `
                                <a href="#/recipe/${w.recipe.id}" class="related-link">
                                    <span class="veg-indicator" data-veg="${w.recipe.veg}"></span>
                                    ${w.recipe.name}
                                    <span class="text-margin">${w.note}</span>
                                </a>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

function renderShopAccordion(scaled, original, ingredientsDb, open) {
    return `
        <div class="accordion" data-accordion="shop" data-open="${open}">
            <button class="accordion-trigger">
                <span>Shop</span>
                <span class="accordion-icon">▼</span>
            </button>
            <div class="accordion-content">
                <div class="scaler">
                    <button class="scale-btn" data-scale="1" ${currentScale === 1 ? 'data-active="true"' : ''}>1x</button>
                    <button class="scale-btn" data-scale="2" ${currentScale === 2 ? 'data-active="true"' : ''}>2x</button>
                    <button class="scale-btn" data-scale="4" ${currentScale === 4 ? 'data-active="true"' : ''}>4x</button>
                </div>
                <ul class="ingredient-list">
                    ${scaled.ingredients.map(ing => `
                        <li class="ingredient-item">
                            <span class="ingredient-qty text-mono">${ing.qty_g}g</span>
                            <span class="ingredient-name">${ing.display}</span>
                            ${ing.sub ? `<span class="ingredient-sub">Sub: ${ing.sub}</span>` : ''}
                        </li>
                    `).join('')}
                </ul>
            </div>
        </div>
    `;
}

function renderCookAccordion(recipe, open) {
    return `
        <div class="accordion" data-accordion="cook" data-open="${open}">
            <button class="accordion-trigger">
                <span>Cook</span>
                <span class="accordion-icon">▼</span>
            </button>
            <div class="accordion-content">
                <ol class="steps-list">
                    ${recipe.steps.map((step, i) => `
                        <li class="step-item">
                            <div class="step-title">${i + 1}. ${step.title}</div>
                            <p class="step-text">${step.text}</p>
                            ${step.timer_s > 0 ? `<div class="step-timer text-mono">${formatTime(step.timer_s)}</div>` : ''}
                            ${step.cue ? `<div class="step-cue text-margin">${step.cue}</div>` : ''}
                        </li>
                    `).join('')}
                </ol>
                ${recipe.rescues && recipe.rescues.length > 0 ? `
                    <div class="rescues">
                        <h4>Rescues</h4>
                        ${recipe.rescues.map(r => `
                            <div class="rescue-item">
                                <strong>${r.problem}:</strong> ${r.fix}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                ${recipe.spice && (recipe.spice.dial_up || recipe.spice.dial_down) ? `
                    <div class="spice-dial">
                        <h4>Spice dial</h4>
                        ${recipe.spice.dial_up ? `<div class="rescue-item"><strong>Hotter:</strong> ${recipe.spice.dial_up}</div>` : ''}
                        ${recipe.spice.dial_down ? `<div class="rescue-item"><strong>Milder:</strong> ${recipe.spice.dial_down}</div>` : ''}
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

function renderAfterAccordion(recipe, open) {
    return `
        <div class="accordion" data-accordion="after" data-open="${open}">
            <button class="accordion-trigger">
                <span>After</span>
                <span class="accordion-icon">▼</span>
            </button>
            <div class="accordion-content">
                ${recipe.leftovers ? `
                    <div class="leftovers-info">
                        <p><strong>Verdict:</strong> ${recipe.leftovers.verdict}</p>
                        <p><strong>Keeps:</strong> ${recipe.leftovers.days} days in fridge</p>
                        ${recipe.leftovers.reheat ? `<p><strong>Reheat:</strong> ${recipe.leftovers.reheat}</p>` : ''}
                        ${recipe.leftovers.freezer ? `<p><strong>Freezer:</strong> ${recipe.leftovers.freezer}</p>` : ''}
                    </div>
                ` : ''}
                ${recipe.rel.leftovers_become && recipe.rel.leftovers_become.length > 0 ? `
                    <div class="leftovers-become">
                        <h4>Leftovers become</h4>
                        ${recipe.rel.leftovers_become.map(item => {
                            const target = window.cookbook.recipes.find(r => r.id === item.into);
                            return `
                                <a href="#/recipe/${item.into}" class="leftover-link">
                                    ${target ? target.name : item.into} <span class="text-margin">${item.note}</span>
                                </a>
                            `;
                        }).join('')}
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

function renderHostAccordion(recipe, open) {
    return `
        <div class="accordion" data-accordion="host" data-open="${open}">
            <button class="accordion-trigger">
                <span>Host</span>
                <span class="accordion-icon">▼</span>
            </button>
            <div class="accordion-content">
                <p><strong>Call it:</strong> "${recipe.host.call_it}"</p>
                <p><strong>Plating:</strong> ${recipe.host.plating}</p>
                <p><strong>Prep ahead:</strong> ${recipe.host.prep_ahead}</p>
            </div>
        </div>
    `;
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} min`;
}

function attachRecipeHandlers(container, recipe) {
    // Accordion toggles
    container.querySelectorAll('.accordion-trigger').forEach(trigger => {
        trigger.addEventListener('click', () => {
            const accordion = trigger.closest('.accordion');
            const isOpen = accordion.dataset.open === 'true';
            accordion.dataset.open = !isOpen;
        });
    });
    
    // Scale buttons
    container.querySelectorAll('.scale-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentScale = parseInt(btn.dataset.scale);
            renderRecipe(container, recipe.id);
        });
    });
}
