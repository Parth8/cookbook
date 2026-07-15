// Fridge matcher view

import { matchRecipesToFridge, getPerishableIngredients, formatMatchLine } from '../lib/match.js';

let selectedIngredients = [];

export function renderFridge(container) {
    const { ingredients, recipes } = window.cookbook;
    const perishables = getPerishableIngredients(ingredients);
    const matches = matchRecipesToFridge(recipes, selectedIngredients);
    
    container.innerHTML = `
        <div class="view-fridge">
            <h1>Fridge Matcher</h1>
            <p class="view-description">Tap what's in your fridge, get ranked matches</p>
            
            <div class="fridge-grid">
                ${perishables.map(ing => `
                    <button class="fridge-chip" 
                            data-ref="${ing.ref}"
                            data-selected="${selectedIngredients.includes(ing.ref)}">
                        ${ing.name}
                    </button>
                `).join('')}
            </div>
            
            ${selectedIngredients.length > 0 ? `
                <div class="match-results">
                    <h2>Matches (${matches.length})</h2>
                    ${matches.length === 0 ? 
                        '<p class="empty-state">No recipes match these ingredients</p>' :
                        matches.map(match => `
                            <a href="#/recipe/${match.recipe.id}" class="match-card">
                                <div class="match-name">
                                    <span class="veg-indicator" data-veg="${match.recipe.veg}"></span>
                                    ${match.recipe.name}
                                </div>
                                <div class="match-line text-mono">
                                    ${formatMatchLine(match, selectedIngredients.length)}
                                </div>
                                <div class="match-meta text-mono">
                                    ${match.recipe.macros.kcal} kcal · ${match.recipe.macros.protein_g}g protein · ${match.recipe.time.active_min} min
                                </div>
                            </a>
                        `).join('')
                    }
                </div>
            ` : '<p class="text-margin">Select ingredients to see matches</p>'}
        </div>
    `;
    
    attachFridgeHandlers(container);
}

function attachFridgeHandlers(container) {
    container.querySelectorAll('.fridge-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const ref = chip.dataset.ref;
            const index = selectedIngredients.indexOf(ref);
            
            if (index === -1) {
                selectedIngredients.push(ref);
            } else {
                selectedIngredients.splice(index, 1);
            }
            
            renderFridge(container);
        });
    });
}
