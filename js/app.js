// Router + state.
// Mode toggle removed: the design is now readable by default, so there is
// nothing to escape from. One design, done properly.

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
  setColophon();
  setupSearch();
  setupKeys();
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

async function loadData() {
  try {
    const [recipes, ingredients, tags] = await Promise.all([
      fetch('data/recipes.json').then(r => r.json()),
      fetch('data/ingredients.json').then(r => r.json()),
      fetch('data/tags.json').then(r => r.json())
    ]);
    Object.assign(window.cookbook, {
      recipes, ingredients, tags, graph: buildRelationshipGraph(recipes)
    });
  } catch (e) {
    console.error('Failed to load data:', e);
    document.getElementById('app').innerHTML =
      '<p class="error">Could not load the menu. Check data/ and reload.</p>';
  }
}

function setColophon() {
  const { recipes } = window.cookbook;
  const core = recipes.filter(r => r.core).length;
  document.getElementById('colophon').textContent =
    `${recipes.length} dishes · ${core} in rotation · high protein, low calorie`;
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

  // View Transitions: progressive enhancement, no-op where unsupported.
  if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.startViewTransition(run);
  } else {
    run();
  }
}

function paint(view, params) {
  const app = document.getElementById('app');
  window.cookbook.currentView = view || 'menu';

  switch (view) {
    case 'tonight': renderTonight(app); break;
    case 'fridge':  renderFridge(app); break;
    case 'planner': renderPlanner(app); break;
    case 'host':    renderHost(app); break;
    case 'recipe':  if (params[0]) renderRecipe(app, params[0], params[1]); break;
    case 'cook':    if (params[0]) renderCookMode(app, params[0]); break;
    default:        renderMenu(app);
  }

  // Back to the board lands where you left it.
  if (!view) requestAnimationFrame(() => window.scrollTo(0, menuScroll));
  else window.scrollTo(0, 0);
}

// ---------------------------------------------------------------- search

function setupSearch() {
  const modal = document.querySelector('.search-modal');
  const input = document.querySelector('.search-input');
  const results = document.querySelector('.search-results');

  const open = () => { modal.hidden = false; input.focus(); };
  const close = () => { modal.hidden = true; input.value = ''; results.innerHTML = ''; };

  document.querySelector('.search-trigger').addEventListener('click', open);
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
    return `
      <a href="#/recipe/${r.id}" class="search-result">
        <span class="search-result-name">
          <span class="veg-indicator" data-veg="${r.veg}"></span>
          ${r.name}
          ${alias ? `<span class="search-result-aka text-margin">aka ${alias}</span>` : ''}
        </span>
        <span class="search-result-meta">${r.macros.kcal} kcal · ${
          r.macros.alcohol_g > 0 ? `${r.macros.alcohol_g}g alc` : `${r.macros.protein_g}g P`}</span>
      </a>`;
  }).join('');
}

function setupKeys() {
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); window.__cookbookSearch.open(); }
    if (e.key === 'Escape') window.__cookbookSearch.close();
  });
}

init();

export { handleRoute };
