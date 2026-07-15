// Faceted filtering.
//
// FIXED: the old toggleFilterChip cycled default -> included -> excluded on a
// plain click, so tapping a chip twice to clear it silently EXCLUDED it instead.
// Include and exclude are now separate intents with separate affordances.

export function createFilterState() {
  return {};
}

export function getChipState(state, facet, value) {
  const f = state[facet];
  if (!f) return 'default';
  if (f.included.includes(value)) return 'included';
  if (f.excluded.includes(value)) return 'excluded';
  return 'default';
}

function ensure(state, facet) {
  if (!state[facet]) state[facet] = { included: [], excluded: [] };
  return state[facet];
}

function detach(state, facet, value) {
  const f = ensure(state, facet);
  f.included = f.included.filter(v => v !== value);
  f.excluded = f.excluded.filter(v => v !== value);
  if (!f.included.length && !f.excluded.length) delete state[facet];
}

/**
 * Toggle a chip.
 * @param mode 'include' (tap) or 'exclude' (long-press / right-click)
 * Tapping an included chip clears it. It never becomes an exclude by accident.
 */
export function toggleFilterChip(state, facet, value, mode = 'include') {
  const current = getChipState(state, facet, value);
  const target = mode === 'exclude' ? 'excluded' : 'included';

  detach(state, facet, value);

  if (current === target) return 'default';   // same intent twice = off

  ensure(state, facet)[target].push(value);
  return target;
}

export function setChipState(state, facet, value, next) {
  detach(state, facet, value);
  if (next === 'default') return 'default';
  ensure(state, facet)[next].push(value);
  return next;
}

/** Start cards MERGE into active filters. They used to replace them silently. */
export function mergeQuery(state, query) {
  for (const [facet, values] of Object.entries(query)) {
    for (const value of values) {
      if (getChipState(state, facet, value) === 'default') {
        ensure(state, facet).included.push(value);
      }
    }
  }
  return state;
}

export function clearFilters(state) {
  for (const k of Object.keys(state)) delete state[k];
  return state;
}

export function hasActiveFilters(state) {
  return Object.keys(state).length > 0;
}

export function countActive(state) {
  return Object.values(state).reduce((n, f) => n + f.included.length + f.excluded.length, 0);
}

/** Flat list of active selections, for rendering pills. */
export function activeList(state) {
  const out = [];
  for (const [facet, f] of Object.entries(state)) {
    f.included.forEach(value => out.push({ facet, value, state: 'included' }));
    f.excluded.forEach(value => out.push({ facet, value, state: 'excluded' }));
  }
  return out;
}

/** AND across facets, OR within a facet. */
export function filterRecipes(recipes, state) {
  const facets = Object.entries(state);
  if (!facets.length) return recipes;

  return recipes.filter(recipe => {
    for (const [facet, { included, excluded }] of facets) {
      const tags = recipe.tags?.[facet] || [];
      if (included.length && !included.some(t => tags.includes(t))) return false;
      if (excluded.length && excluded.some(t => tags.includes(t))) return false;
    }
    return true;
  });
}
