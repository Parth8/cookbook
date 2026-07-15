// Filter utilities for faceted search

export function filterRecipes(recipes, filters) {
    if (Object.keys(filters).length === 0) {
        return recipes;
    }
    
    return recipes.filter(recipe => {
        // AND across facets
        for (const [facet, states] of Object.entries(filters)) {
            const included = states.included || [];
            const excluded = states.excluded || [];
            const recipeTags = recipe.tags[facet] || [];
            
            // Must include at least one from included (OR within facet)
            if (included.length > 0) {
                const hasIncluded = included.some(tag => recipeTags.includes(tag));
                if (!hasIncluded) return false;
            }
            
            // Must not include any from excluded
            if (excluded.length > 0) {
                const hasExcluded = excluded.some(tag => recipeTags.includes(tag));
                if (hasExcluded) return false;
            }
        }
        
        return true;
    });
}

export function createFilterState() {
    return {};
}

export function toggleFilterChip(filterState, facet, value, state = 'default') {
    // Tri-state: default -> included -> excluded -> default
    const states = ['default', 'included', 'excluded'];
    const currentState = getChipState(filterState, facet, value);
    const currentIndex = states.indexOf(currentState);
    const nextIndex = (currentIndex + 1) % states.length;
    const nextState = states[nextIndex];
    
    if (!filterState[facet]) {
        filterState[facet] = { included: [], excluded: [] };
    }
    
    // Remove from all arrays first
    filterState[facet].included = filterState[facet].included.filter(v => v !== value);
    filterState[facet].excluded = filterState[facet].excluded.filter(v => v !== value);
    
    // Add to appropriate array
    if (nextState === 'included') {
        filterState[facet].included.push(value);
    } else if (nextState === 'excluded') {
        filterState[facet].excluded.push(value);
    }
    
    return nextState;
}

export function getChipState(filterState, facet, value) {
    if (!filterState[facet]) return 'default';
    
    if (filterState[facet].included.includes(value)) return 'included';
    if (filterState[facet].excluded.includes(value)) return 'excluded';
    return 'default';
}

export function clearFilters(filterState) {
    for (const key in filterState) {
        delete filterState[key];
    }
}

export function hasActiveFilters(filterState) {
    return Object.keys(filterState).some(facet => {
        return filterState[facet].included.length > 0 || 
               filterState[facet].excluded.length > 0;
    });
}

export function getFilterCounts(recipes, filterState, facet) {
    // Count how many recipes match each tag value in a facet
    const counts = {};
    const currentFiltered = filterRecipes(recipes, filterState);
    
    currentFiltered.forEach(recipe => {
        const tags = recipe.tags[facet] || [];
        tags.forEach(tag => {
            counts[tag] = (counts[tag] || 0) + 1;
        });
    });
    
    return counts;
}
