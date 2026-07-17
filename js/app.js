// Router + state.
// Mode toggle removed: one design, done properly.
//
// This build adds:
// 1. Cache-busted data fetches so no browser holds stale recipes.json / tags.json
// 2. Verbose error reporting - if anything throws during load, you SEE the
//    stack trace on the page instead of a generic "Could not load menu"
// 3. A defensive guard on the diet derivation in case any recipe is malformed

import { renderMenu } from './views/menu.js';
import { renderTonight } from './views/tonight.js';
import { renderFridge } from './views/fridge.js';
import { renderPlanner } from './views/planner.js';
import { renderHost } from './views/host.js';
import { renderRecipe } from './views/recipe.js';
import { renderCookMode } from './views/cook.js';
import { buildRelationshipGraph } from './lib/rel.js';

window.cookbook = { recipes: [], ingredients: [], tags: {}, graph: {}, currentView: 'menu' };

let menuScroll = 0;

async function init() {
  await loadData();
  if (!window.cookbook.recipes.length) return;   // loadData already showed the error
  setColophon();
  setupSearch();
  setupKeys();
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

async function loadData() {
  // Cache bust — GitHub Pages + browser both cache aggressively.
  // Appending a stamp forces a fresh fetch on every page load.
  const bust = `?v=${Date.now()}`;

  let stage = 'fetch';
  try {
    const [recipes, ingredients, tags] = await Promise.all([
      fetch('data/recipes.json' + bust).then(r => {
        if (!r.ok) throw new Error(`recipes.json HTTP ${r.status}`);
        return r.json();
      }),
      fetch('data/ingredients.json' + bust).then(r => {
        if (!r.ok) throw new Error(`ingredients.json HTTP ${r.status}`);
        return r.json();
      }),
      fetch('data/tags.json' + bust).then(r => {
        if (!r.ok) throw new Error(`tags.json HTTP ${r.status}`);
        return r.json();
      })
    ]);

    stage = 'validate';
    if (!Array.isArray(recipes)) throw new Error(`recipes.json is not an array (got ${typeof recipes})`);
    if (!Array.isArray(ingredients)) throw new Error(`ingredients.json is not an array`);
    if (!tags || typeof tags !== 'object') throw new Error(`tags.json is not an object`);
    if (recipes.length === 0) throw new Error(`recipes.json is empty`);

    stage = 'derive-diet';
    recipes.forEach((r, i) => {
      if (!r || typeof r !== 'object') throw new Error(`recipe #${i} is not an object`);
      if (!r.tags) r.tags = {};
      const proteins = r.tags.protein || [];
      const isEgg = proteins.includes('egg') && !proteins.some(p => ['chicken','fish'].includes(p));
      r.tags.diet = r.veg ? ['veg'] : isEgg ? ['egg-veg'] : ['non-veg'];
    });

    stage = 'build-graph';
    // Defensive: ensure every recipe has a rel object before buildRelationshipGraph runs
    recipes.forEach((r, i) => {
      if (!r.rel || typeof r.rel !== 'object') {
        r.rel = { pairs_with: [], similar_to: [], leftovers_become: [], drink: [] };
      }
    });
    const graph = buildRelationshipGraph(recipes);

    stage = 'assign';
    Object.assign(window.cookbook, { recipes, ingredients, tags, graph });

    console.log(`[cookbook] Loaded ${recipes.length} recipes, ${ingredients.length} ingredients, ${Object.keys(tags).length} facets`);
  } catch (e) {
    console.error(`[cookbook] Load failed at stage: ${stage}`, e);
    document.getElementById('app').innerHTML = `
      <div style="padding: 2rem; font-family: system-ui, sans-serif; max-width: 42rem; margin: 2rem auto; background: #FEF3F2; border: 1px solid #B33010; border-radius: 6px;">
        <h2 style="color: #B33010; margin-bottom: 1rem;">Load failed</h2>
        <p style="margin-bottom: 0.5rem;"><strong>Stage:</strong> ${stage}</p>
        <p style="margin-bottom: 0.5rem;"><strong>Error:</strong> ${e.message}</p>
        <pre style="background: #fff; padding: 1rem; overflow: auto; font-size: 0.75rem; max-height: 20rem;">${(e.stack || '').replace(/</g, '&lt;')}</pre>
        <p style="margin-top: 1rem; font-size: 0.85rem; color: #666;">Screenshot this and send it. It tells us exactly what's broken.</p>
      </div>`;
  }
}

function setColophon() {
  const { recipes } = window.cookbook;
  const core = recipes.filter(r => r.core).length;
  const el = document.getElementById('colophon');
  if (el) el.textContent = `${recipes.length} dishes · ${core} in rotation · high protein, low calorie`;
}

// ---------------------------------------------------------------- router

function handleRoute() {
  const hash = location.hash.slice(1) || '/';
  const [, view, ...params] = hash.split('/');

  if (window.cookbook.currentView === 'menu' && view !== '') menuScroll = window.scrollY;

  document.querySelectorAll('.nav-link, .tab-item').forEach(l => {
    l.dataset.active = String(l.dataset.view === view || (!view && l.dataset.view === 'menu'));
  });

  const run = () => paint(view, params);

  if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.startViewTransition(run);
  } else {
    run();
  }
}

function paint(view, params) {
  const app = document.getElementById('app');
  window.cookbook.currentView = view || 'menu';

  try {
    switch (view) {
      case 'tonight': renderTonight(app); break;
      case 'fridge':  renderFridge(app); break;
      case 'planner': renderPlanner(app); break;
      case 'host':    renderHost(app); break;
      case 'recipe':  if (params[0]) renderRecipe(app, params[0], params[1]); break;
      case 'cook':    if (params[0]) renderCookMode(app, params[0]); break;
      default:        renderMenu(app);
    }
  } catch (e) {
    console.error(`[cookbook] Render failed for view "${view}":`, e);
    app.innerHTML = `
      <div style="padding: 2rem; font-family: system-ui;">
        <h2 style="color: #B33010;">Render failed on view: ${view || 'menu'}</h2>
        <p><strong>Error:</strong> ${e.message}</p>
        <pre style="background: #EBE8E2; padding: 1rem; overflow: auto; font-size: 0.75rem;">${(e.stack || '').replace(/</g, '&lt;')}</pre>
      </div>`;
  }

  if (!view) requestAnimationFrame(() => window.scrollTo(0, menuScroll));
  else window.scrollTo(0, 0);
}

// ---------------------------------------------------------------- search

function setupSearch() {
  const modal = document.querySelector('.search-modal');
  const input = document.querySelector('.search-input');
  const results = document.querySelector('.search-results');
  if (!modal || !input || !results) return;

  const open = () => { modal.hidden = false; input.focus(); };
  const close = () => { modal.hidden = true; input.value = ''; results.innerHTML = ''; };

  const trigger = document.querySelector('.search-trigger');
  if (trigger) trigger.addEventListener('click', open);
  modal.addEventListener('click', e => {
    if (e.target === modal || e.target.closest('.search-result')) close();
  });
  input.addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    results.innerHTML = q ? render(search(q), q) : '';
  });

  window.__cookbookSearch = { open, close };
}

function search(q) {
  const { recipes, tags } = window.cookbook;

  const byName = recipes.filter(r =>
    r.name.toLowerCase().includes(q) ||
    (r.aka || []).some(a => a.toLowerCase().includes(q)) ||
    (r.tagline || '').toLowerCase().includes(q)
  );

  const byTag = new Set();
  for (const [facet, cfg] of Object.entries(tags)) {
    for (const v of cfg.values || []) {
      if (!v.includes(q)) continue;
      recipes.forEach(r => { if (r.tags[facet]?.includes(v)) byTag.add(r); });
    }
  }

  return [...new Set([...byName, ...byTag])].slice(0, 10);
}

function render(list, q) {
  if (!list.length) return '<p class="search-empty">No dishes match that.</p>';
  return list.map(r => {
    const alias = !r.name.toLowerCase().includes(q)
      ? (r.aka || []).find(a => a.toLowerCase().includes(q)) : null;
    const isDrink = (r.tags.meal || []).includes('drink');
    const rightMeta = (r.macros.alcohol_g > 0) ? `${r.macros.alcohol_g}g alc`
                    : isDrink ? '' : `${r.macros.protein_g}g P`;
    return `
      <a href="#/recipe/${r.id}" class="search-result">
        <span class="search-result-name">
          <span class="veg-indicator" data-veg="${r.veg}"></span>
          ${r.name}
          ${alias ? `<span class="search-result-aka text-margin">aka ${alias}</span>` : ''}
        </span>
        <span class="search-result-meta">${r.macros.kcal} kcal${rightMeta ? ' · ' + rightMeta : ''}</span>
      </a>`;
  }).join('');
}

function setupKeys() {
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); window.__cookbookSearch?.open(); }
    if (e.key === 'Escape') window.__cookbookSearch?.close();
  });
}

init();

export { handleRoute };
