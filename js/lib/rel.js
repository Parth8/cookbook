// Relationship graph builder

export function buildRelationshipGraph(recipes) {
    const graph = {};
    
    recipes.forEach(recipe => {
        graph[recipe.id] = {
            // Authored relationships
            pairs_with: recipe.rel.pairs_with || [],
            similar_to: recipe.rel.similar_to || [],
            leftovers_become: recipe.rel.leftovers_become || [],
            drink: recipe.rel.drink || [],
            
            // Computed relationships
            uses: computeUses(recipe),
            appears_in: [],
            wanted_by: []
        };
    });
    
    // Compute backlinks
    recipes.forEach(recipe => {
        // Pairs_with is bidirectional
        (recipe.rel.pairs_with || []).forEach(targetId => {
            if (graph[targetId]) {
                if (!graph[targetId].pairs_with.includes(recipe.id)) {
                    graph[targetId].pairs_with.push(recipe.id);
                }
            }
        });
        
        // Leftovers_become creates backlinks
        (recipe.rel.leftovers_become || []).forEach(item => {
            const targetId = item.into;
            if (graph[targetId]) {
                graph[targetId].wanted_by.push({
                    from: recipe.id,
                    note: item.note
                });
            }
        });
    });
    
    return graph;
}

function computeUses(recipe) {
    // Extract unique ingredient refs
    return [...new Set(recipe.ingredients.map(i => i.ref))];
}

export function findOverlaps(recipes, selectedRecipeIds) {
    // Find recipes that use up ingredients opened by selected recipes
    const openedIngredients = {};
    
    selectedRecipeIds.forEach(id => {
        const recipe = recipes.find(r => r.id === id);
        if (!recipe) return;
        
        recipe.ingredients.forEach(ing => {
            if (ing.perishable) {
                if (!openedIngredients[ing.ref]) {
                    openedIngredients[ing.ref] = [];
                }
                openedIngredients[ing.ref].push(id);
            }
        });
    });
    
    // Find recipes that use these ingredients
    const suggestions = [];
    
    recipes.forEach(recipe => {
        if (selectedRecipeIds.includes(recipe.id)) return;
        
        const matchingIngredients = [];
        recipe.ingredients.forEach(ing => {
            if (openedIngredients[ing.ref]) {
                matchingIngredients.push(ing.ref);
            }
        });
        
        if (matchingIngredients.length > 0) {
            suggestions.push({
                recipe,
                matches: matchingIngredients,
                reason: `Finishes ${matchingIngredients[0].replace(/-/g, ' ')}`
            });
        }
    });
    
    // Sort by number of matches
    suggestions.sort((a, b) => b.matches.length - a.matches.length);
    
    return suggestions.slice(0, 5);
}

export function getRelatedRecipes(recipe, graph, recipes) {
    const rel = graph[recipe.id];
    if (!rel) return {};
    
    const resolve = (ids) => {
        return ids.map(id => recipes.find(r => r.id === id)).filter(Boolean);
    };
    
    return {
        pairs_with: resolve(rel.pairs_with),
        similar_to: resolve(rel.similar_to),
        leftovers_become: rel.leftovers_become,
        drink: resolve(rel.drink),
        wanted_by: rel.wanted_by
    };
}
