// Fridge matcher - weighted set intersection

export function matchRecipesToFridge(recipes, selectedIngredients) {
    if (selectedIngredients.length === 0) {
        return [];
    }
    
    const matches = recipes.map(recipe => {
        const recipeRefs = recipe.ingredients.map(i => i.ref);
        const score = calculateMatchScore(recipe, selectedIngredients);
        const missing = findMissingIngredients(recipe, selectedIngredients);
        
        return {
            recipe,
            score,
            missing,
            // How many of the user's selections this recipe actually uses
            matchCount: selectedIngredients.filter(ref => recipeRefs.includes(ref)).length
        };
    }).filter(m => m.score > 0);
    
    // Sort by score (desc), then by active time (asc)
    matches.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.recipe.time.active_min - b.recipe.time.active_min;
    });
    
    return matches;
}

function calculateMatchScore(recipe, selectedRefs) {
    let score = 0;
    const recipeRefs = recipe.ingredients.map(i => i.ref);
    
    selectedRefs.forEach(ref => {
        if (recipeRefs.includes(ref)) {
            // Weight main protein 2x
            const isMainProtein = recipe.tags.protein?.some(p => 
                ref.includes(p) || p.includes(ref.split('-')[0])
            );
            score += isMainProtein ? 2 : 1;
        }
    });
    
    return score;
}

function findMissingIngredients(recipe, selectedRefs) {
    const missing = [];
    
    recipe.ingredients.forEach(ingredient => {
        // Only count perishables as missing
        if (ingredient.perishable && !selectedRefs.includes(ingredient.ref)) {
            missing.push(ingredient);
        }
    });
    
    return missing;
}

export function getPerishableIngredients(ingredients) {
    return ingredients.filter(i => i.perishable);
}

export function formatMatchLine(match, totalSelected) {
    const { matchCount, missing } = match;
    
    if (missing.length === 0) {
        return `Uses all ${totalSelected} ingredients`;
    }
    
    const missingNames = missing.slice(0, 2).map(i => i.display.split(',')[0]);
    const moreCount = missing.length - 2;
    
    let text = `Uses ${matchCount} of ${totalSelected}`;
    
    if (missing.length > 0) {
        text += ` · Need: ${missingNames.join(', ')}`;
        if (moreCount > 0) {
            text += ` +${moreCount} more`;
        }
    }
    
    return text;
}
