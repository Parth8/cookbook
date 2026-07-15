// Macro calculations and validations

export function computeRecipeMacros(recipe, ingredientsDb) {
    let totals = {
        kcal: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
        alcohol_g: 0
    };
    
    recipe.ingredients.forEach(ingredient => {
        const ref = ingredientsDb.find(i => i.ref === ingredient.ref);
        if (!ref) {
            console.warn(`Ingredient not found: ${ingredient.ref}`);
            return;
        }
        
        const factor = ingredient.qty_g / 100;
        const macros = ref.macros_per_100g;
        
        totals.kcal += macros.kcal * factor;
        totals.protein_g += macros.protein_g * factor;
        totals.carbs_g += macros.carbs_g * factor;
        totals.fat_g += macros.fat_g * factor;
        
        if (macros.alcohol_g) {
            totals.alcohol_g += macros.alcohol_g * factor;
        }
    });
    
    // Round to 1 decimal
    Object.keys(totals).forEach(key => {
        totals[key] = Math.round(totals[key] * 10) / 10;
    });
    
    return totals;
}

export function validateMacros(stated, computed) {
    // kcal should equal 4P + 4C + 9F + 7A within 10%
    const theoretical = 
        (computed.protein_g * 4) + 
        (computed.carbs_g * 4) + 
        (computed.fat_g * 9) + 
        (computed.alcohol_g * 7);
    
    const diff = Math.abs(stated.kcal - theoretical);
    const tolerance = theoretical * 0.1;
    
    return {
        valid: diff <= tolerance,
        stated: stated.kcal,
        computed: Math.round(theoretical),
        diff: Math.round(diff)
    };
}

export function scaleRecipe(recipe, factor) {
    return {
        ...recipe,
        ingredients: recipe.ingredients.map(ing => ({
            ...ing,
            qty_g: Math.round(ing.qty_g * factor * 10) / 10
        })),
        macros: {
            kcal: Math.round(recipe.macros.kcal * factor),
            protein_g: Math.round(recipe.macros.protein_g * factor * 10) / 10,
            carbs_g: Math.round(recipe.macros.carbs_g * factor * 10) / 10,
            fat_g: Math.round(recipe.macros.fat_g * factor * 10) / 10,
            ...(recipe.macros.alcohol_g != null && {
                alcohol_g: Math.round(recipe.macros.alcohol_g * factor * 10) / 10
            })
        }
    };
}

export function getProteinDensity(macros) {
    // Protein grams per 100 kcal
    return Math.round((macros.protein_g / macros.kcal) * 100 * 10) / 10;
}

export function getCostBandLabel(band) {
    return '₹'.repeat(band);
}

export function meetsProteinFloor(recipe) {
    const floors = {
        breakfast: 25,
        lunch: 30,
        dinner: 30,
        snack: 10,
        dessert: 12
    };
    
    const meal = recipe.tags.meal?.[0];
    const floor = floors[meal] || 0;
    
    return {
        meets: recipe.macros.protein_g >= floor,
        floor,
        actual: recipe.macros.protein_g
    };
}
