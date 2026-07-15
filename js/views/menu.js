// Menu view - Start strip + board + filters

import { filterRecipes, createFilterState, toggleFilterChip, getChipState, clearFilters, hasActiveFilters } from '../lib/filters.js';

let filterState = createFilterState();

export function renderMenu(container) {
    const { recipes, tags } = window.cookbook;
    
    // Sort recipes: core first, then by number
    const sortedRecipes = [...recipes].sort((a, b) => {
        if (a.core && !b.core) return -1;
        if (!a.core && b.core) return 1;
        return (a.no ?? 999) - (b.no ?? 999);
    });
    
    const filtered = filterRecipes(sortedRecipes, filterState);
    
    container.innerHTML = `
        <div class="menu-view">
            ${renderStartStrip()}
            ${renderFilters(tags)}
            ${renderBoard(filtered)}
        </div>
    `;
    
    attachMenuHandlers(container);
}

function renderStartStrip() {
    const entryPoints = [
        { title: 'I have chicken', query: { protein: ['chicken'] } },
        { title: 'I have 20 minutes', query: { time: ['under-15', 'under-30'] } },
        { title: 'I want comfort', query: { mood: ['comfort'] } },
        { title: "Someone's coming", query: { occasion: ['date-night', 'party'] } },
        { title: 'Post-workout fuel', query: { occasion: ['post-workout'] } },
        { title: 'Zero cleanup', query: { equipment: ['one-pan'] } },
        { title: 'Leftover rice', query: { pantry: ['uses-leftover-rice'] } },
        { title: 'Desi comfort', query: { cuisine: ['north-indian', 'punjabi'] } },
        { title: 'Soup weather', query: { meal: ['soup'] } },
        { title: 'Coffee o\u2019clock', query: { cuisine: ['cafe'] } },
        { title: 'Behind the bar', query: { cuisine: ['bar'] } }
    ];
    
    return `
        <div class="start-strip">
            ${entryPoints.map(ep => `
                <div class="start-card" data-query='${JSON.stringify(ep.query)}'>
                    <div class="start-card-title">${ep.title}</div>
                    <div class="start-card-description">
                        ${getQueryDescription(ep.query)}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function getQueryDescription(query) {
    const { recipes } = window.cookbook;
    const count = filterRecipes(recipes, convertQueryToFilter(query)).length;
    return `${count} dishes`;
}

function convertQueryToFilter(query) {
    const filter = {};
    for (const [facet, values] of Object.entries(query)) {
        filter[facet] = { included: values, excluded: [] };
    }
    return filter;
}

function renderFilters(tags) {
    const priorityFacets = ['protein', 'time', 'cuisine', 'occasion', 'nutrition', 'equipment', 'temp', 'strength'];
    
    return `
        <div class="filter-bar">
            ${priorityFacets.map(facet => renderFacetChips(facet, tags[facet])).join('')}
            ${hasActiveFilters(filterState) ? '<button class="clear-filters-btn">Clear all</button>' : ''}
        </div>
    `;
}

function renderFacetChips(facet, config) {
    return `
        <div class="facet-group" data-facet="${facet}">
            <div class="facet-label">${formatFacetName(facet)}</div>
            <div class="chip-group">
                ${config.values.map(value => {
                    const state = getChipState(filterState, facet, value);
                    return `
                        <button class="chip" 
                                data-facet="${facet}" 
                                data-value="${value}"
                                data-state="${state}">
                            ${formatTagValue(value)}
                        </button>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

function formatFacetName(facet) {
    return facet.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}

function formatTagValue(value) {
    return value.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}

// Course sections are a rendering of the meal facet, not a storage model.
// Drinks split into Café and Bar by cuisine.
const SECTION_ORDER = [
    { meal: 'breakfast', label: 'Breakfast', wash: 'haldi' },
    { meal: 'lunch', label: 'Quick Lunches', wash: 'pistachio' },
    { meal: 'soup', label: 'Soups', wash: 'pistachio' },
    { meal: 'dinner', label: 'Mains', wash: 'apricot' },
    { meal: 'snack', label: 'Snacks', wash: 'haldi' },
    { meal: 'dessert', label: 'Desserts', wash: 'rose-milk' },
    { meal: 'side', label: 'Sides & Pairings', wash: 'pistachio' },
    { meal: 'drink', cuisine: 'cafe', label: 'Café', wash: 'haldi' },
    { meal: 'drink', cuisine: 'bar', label: 'Bar', wash: 'rose-milk' }
];

function renderBoard(recipes) {
    if (recipes.length === 0) {
        return '<div class="empty-state">No recipes match these filters</div>';
    }
    
    // Group by primary meal tag, core-first within each section
    const sections = SECTION_ORDER.map(section => ({
        ...section,
        recipes: recipes.filter(r =>
            (r.tags.meal || [])[0] === section.meal &&
            (!section.cuisine || (r.tags.cuisine || []).includes(section.cuisine))
        )
    })).filter(section => section.recipes.length > 0);
    
    let lineIndex = 0;
    
    return `
        <div class="menu-board">
            ${sections.map(section => `
                <section class="menu-section">
                    <h2 class="menu-section-header" data-wash="${section.wash}">
                        ${section.label}
                        <span class="menu-section-count text-mono">${section.recipes.length}</span>
                    </h2>
                    ${section.recipes.map(recipe => renderRecipeLine(recipe, lineIndex++)).join('')}
                </section>
            `).join('')}
        </div>
    `;
}

function renderRecipeLine(recipe, index) {
    return `
        <div class="recipe-line" 
             data-id="${recipe.id}" 
             data-expanded="false"
             style="--index: ${index}">
            <div class="recipe-line-main">
                <div class="recipe-sketch" data-hot="${isHotDish(recipe)}" data-drink="${isDrink(recipe)}">
                    <svg width="48" height="48" viewBox="0 0 48 48">
                        <circle cx="24" cy="24" r="20" fill="${getSketchColor(recipe)}" opacity="0.2"/>
                        <circle cx="24" cy="24" r="20" fill="none" stroke="var(--color-ink)" stroke-width="2"/>
                    </svg>
                </div>
                <span class="recipe-number text-mono">${recipe.no ?? '·'}</span>
                <span class="veg-indicator" data-veg="${recipe.veg}"></span>
                <span class="recipe-name">${recipe.name}${recipe.core ? ' <span class="core-dot" title="Core rotation">●</span>' : ''}</span>
                <div class="recipe-macros text-mono">
                    <span>${recipe.macros.kcal} kcal</span>
                    ${isDrink(recipe)
                        ? `<span>${formatStrength(recipe)}</span>`
                        : `<span>${recipe.macros.protein_g}g protein</span>`}
                </div>
            </div>
            <div class="recipe-details">
                <p class="recipe-tagline">${recipe.tagline}</p>
                ${recipe.aka?.length ? `
                    <p class="recipe-aka">aka ${recipe.aka.join(' · ')}</p>
                ` : ''}
                <div class="recipe-effort">
                    ${recipe.time.active_min}min active · ${recipe.time.passive_min}min passive · ${recipe.cleanup.vessels} vessel
                </div>
                <div class="recipe-tags">
                    ${renderRecipeTags(recipe)}
                </div>
                <a href="#/recipe/${recipe.id}" class="cook-btn">View Recipe</a>
            </div>
        </div>
    `;
}

function isHotDish(recipe) {
    return !recipe.tags.meal?.includes('dessert') && 
           !recipe.tags.meal?.includes('drink') &&
           !recipe.tags.meal?.includes('snack');
}

function isDrink(recipe) {
    return recipe.tags.meal?.includes('drink');
}

function formatStrength(recipe) {
    // Café lines read better as hot/cold; bar lines as pour strength
    if (recipe.tags.cuisine?.includes('cafe')) {
        const temp = recipe.tags.temp?.[0];
        if (temp) return temp === 'hot' ? 'served hot' : 'served cold';
    }
    const strength = recipe.tags.strength?.[0];
    if (strength === 'zero-proof') return 'zero proof';
    if (strength === 'light-pour') return 'light pour';
    if (strength === 'strong-pour') return 'strong pour';
    return `${recipe.macros.protein_g}g protein`;
}

function getSketchColor(recipe) {
    if (recipe.tags.meal?.includes('dessert')) return 'var(--color-rose-milk)';
    if (recipe.tags.meal?.includes('drink')) return 'var(--color-haldi)';
    return 'var(--color-apricot)';
}

function renderRecipeTags(recipe) {
    const allTags = [];
    Object.entries(recipe.tags).forEach(([facet, values]) => {
        values.forEach(value => {
            allTags.push({ facet, value });
        });
    });
    
    return allTags.slice(0, 8).map(({ facet, value }) => `
        <span class="chip chip-small" data-facet="${facet}">
            ${formatTagValue(value)}
        </span>
    `).join('');
}

function attachMenuHandlers(container) {
    // Start strip cards
    container.querySelectorAll('.start-card').forEach(card => {
        card.addEventListener('click', () => {
            const query = JSON.parse(card.dataset.query);
            filterState = convertQueryToFilter(query);
            renderMenu(container);
        });
    });
    
    // Filter chips (tri-state)
    container.querySelectorAll('.filter-bar .chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const facet = chip.dataset.facet;
            const value = chip.dataset.value;
            toggleFilterChip(filterState, facet, value);
            renderMenu(container);
        });
    });
    
    // Clear filters
    const clearBtn = container.querySelector('.clear-filters-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            clearFilters(filterState);
            renderMenu(container);
        });
    }
    
    // Recipe line expand
    container.querySelectorAll('.recipe-line').forEach(line => {
        const main = line.querySelector('.recipe-line-main');
        main.addEventListener('click', (e) => {
            if (e.target.closest('a')) return;
            const isExpanded = line.dataset.expanded === 'true';
            line.dataset.expanded = !isExpanded;
        });
    });
}

export { filterState };
