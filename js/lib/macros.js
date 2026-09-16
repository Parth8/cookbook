// Macro calculations and validations

// Per serving. kcal comes from each ingredient's own kcal figure rather than
// being re-derived from 4/4/9, because those are USDA values that already
// apply the right factors for fibre (cocoa is 228 kcal, not the 438 the
// generic formula gives). batch_prep lines make a syrup that keeps for weeks,
// so they are bought but not drunk in one sitting.
export function computeRecipeMacros(recipe, ingredientsDb) {
    const totals = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, alcohol_g: 0 };
    const serves = recipe.serves || 1;

    recipe.ingredients.forEach(ingredient => {
        if (ingredient.batch_prep) return;

        const ref = ingredientsDb.find(i => i.ref === ingredient.ref);
        if (!ref) {
            console.warn(`Ingredient not found: ${ingredient.ref}`);
            return;
        }

        const factor = ingredient.qty_g / 100;
        const macros = ref.macros_per_100g;
        for (const key of Object.keys(totals)) {
            totals[key] += (macros[key] || 0) * factor;
        }
    });

    for (const key of Object.keys(totals)) {
        totals[key] = Math.round((totals[key] / serves) * 10) / 10;
    }

    return totals;
}

// Fibre yields about 2 kcal/g, not 4, so it comes out of the carb term and
// back in at half rate. Tolerance is loose because USDA applies food-specific
// Atwater factors that the generic formula only approximates.
export function validateMacros(stated, computed) {
    const fiber = computed.fiber_g || 0;
    const netCarbs = Math.max((computed.carbs_g || 0) - fiber, 0);
    const theoretical =
        (computed.protein_g * 4) +
        (netCarbs * 4) +
        (computed.fat_g * 9) +
        ((computed.alcohol_g || 0) * 7) +
        (fiber * 2);

    const diff = Math.abs(stated.kcal - theoretical);

    return {
        valid: diff <= Math.max(theoretical * 0.25, 30),
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

// Same floors scripts/validate.py reports against, so the site and the QA
// pass cannot disagree about what counts as enough protein.
export function meetsProteinFloor(recipe) {
    const floors = {
        breakfast: 25,
        lunch: 30,
        soup: 20,
        dinner: 30,
        snack: 10,
        dessert: 12,
        side: 5
    };
    
    const meal = recipe.tags.meal?.[0];
    const floor = floors[meal] || 0;
    
    return {
        meets: recipe.macros.protein_g >= floor,
        floor,
        actual: recipe.macros.protein_g
    };
}
