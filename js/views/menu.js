// Menu board.
//
// ARCHITECTURE FIX: the old version called container.innerHTML = ... on every
// chip click, rebuilding all 164 lines and re-firing the entrance stagger each
// time. The board now builds ONCE per mount and filter changes only flip
// visibility, animated with FLIP. Stagger runs once per session.

import {
  filterRecipes, createFilterState, toggleFilterChip, getChipState,
  clearFilters, hasActiveFilters, activeList, mergeQuery
} from '../lib/filters.js';

const state = createFilterState();          // survives navigation
let firstPaintDone = false;                 // stagger fires once, ever
let sheetOpen = false;
let showAllFacets = false;

const lineEls = new Map();                  // id -> element
let sectionEls = [];

// Course sections are a rendering of the meal facet, not a storage model.
const SECTIONS = [
  { meal: 'breakfast', label: 'Breakfast' },
  { meal: 'lunch',     label: 'Quick Lunches' },
  { meal: 'dinner',    label: 'Mains' },
  { meal: 'soup',      label: 'Soups' },
  { meal: 'snack',     label: 'Snacks' },
  { meal: 'dessert',   label: 'Desserts' },
  { meal: 'side',      label: 'Sides & Pairings' },
  { meal: 'drink', cuisine: 'cafe', label: 'Café' },
  { meal: 'drink', cuisine: 'bar',  label: 'Bar' }
];

const ENTRY_POINTS = [
  { title: 'I have 20 minutes',     query: { time: ['under-15', 'under-30'] } },
  { title: 'I have chicken',        query: { protein: ['chicken'] } },
  { title: 'Zero cleanup',          query: { equipment: ['one-pan'] } },
  { title: "Someone's coming over", query: { occasion: ['date-night', 'party'] } },
  { title: 'Post-workout',          query: { occasion: ['post-workout'] } },
  { title: 'Behind the bar',        query: { cuisine: ['bar'] } }
];

const PRIORITY_FACETS = ['protein', 'time', 'cuisine', 'occasion', 'nutrition', 'equipment'];

const label = v => v.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
const isDrink = r => r.tags?.meal?.includes('drink');

function rightMeta(r) {
  if (isDrink(r)) {
    if (r.tags.cuisine?.includes('cafe')) {
      const t = r.tags.temp?.[0];
      if (t) return t === 'hot' ? 'served hot' : 'served cold';
    }
    const s = r.tags.strength?.[0];
    if (s) return s.replace(/-/g, ' ');
  }
  return `<b>${r.macros.protein_g}</b>g P`;
}

// ---------------------------------------------------------------- build

export function renderMenu(container) {
  lineEls.clear();
  sectionEls = [];

  const { recipes } = window.cookbook;
  const sorted = [...recipes].sort((a, b) => (a.no ?? 999) - (b.no ?? 999));

  container.innerHTML = `
    <div class="menu-view">
      <div class="start"></div>
      <div class="filters">
        <button class="filter-btn" aria-expanded="false">FILTER +</button>
        <span class="pills"></span>
        <span class="filter-count text-mono"></span>
      </div>
      <div class="sheet" hidden><div class="sheet-inner wrap-none"></div></div>
      <div class="board"></div>
    </div>`;

  buildStart(container.querySelector('.start'));
  buildBoard(container.querySelector('.board'), sorted);
  buildSheet(container.querySelector('.sheet-inner'));
  wire(container);

  apply({ animate: false });

  if (!firstPaintDone) {
    stagger(container);
    firstPaintDone = true;
  }
}

function buildStart(root) {
  const { recipes } = window.cookbook;
  root.innerHTML = ENTRY_POINTS.map((ep, i) => {
    const probe = {};
    for (const [f, vals] of Object.entries(ep.query)) probe[f] = { included: vals, excluded: [] };
    const n = filterRecipes(recipes, probe).length;
    return `
      <button class="start-card" data-query='${JSON.stringify(ep.query)}' style="--i:${i}">
        <span class="start-n">${n}</span>
        <span class="start-t">${ep.title}</span>
      </button>`;
  }).join('');
}

function buildBoard(root, recipes) {
  let i = 0;
  root.innerHTML = SECTIONS.map(sec => {
    const items = recipes.filter(r =>
      (r.tags.meal || [])[0] === sec.meal &&
      (!sec.cuisine || (r.tags.cuisine || []).includes(sec.cuisine))
    );
    if (!items.length) return '';
    return `
      <section class="menu-section" data-meal="${sec.meal}">
        <div class="section-head">
          <h2>${sec.label}</h2>
          <span class="n">${String(items.length).padStart(2, '0')}</span>
        </div>
        ${items.map(r => line(r, i++)).join('')}
      </section>`;
  }).join('');

  root.querySelectorAll('.line').forEach(el => lineEls.set(el.dataset.id, el));
  sectionEls = [...root.querySelectorAll('.menu-section')];
}

function line(r, i) {
  const tag = (r.tagline || '').replace(/"/g, '&quot;');
  return `
    <a class="line" href="#/recipe/${r.id}" data-id="${r.id}" style="--i:${i}">
      <span class="no">${String(r.no ?? 0).padStart(2, '0')}</span>
      <span class="mark" data-veg="${r.veg}" aria-label="${r.veg ? 'Veg' : 'Non-veg'}"></span>
      <span class="name">${r.name}${r.core ? '<span class="core" title="Core rotation">●</span>' : ''}</span>
      <span class="leader"><span class="dots"></span><span class="tagline">${tag}</span></span>
      <span class="macros"><span><b>${r.macros.kcal}</b> kcal</span><span>${rightMeta(r)}</span></span>
      <span class="tagline-m">${tag}</span>
    </a>`;
}

function buildSheet(root) {
  const { tags } = window.cookbook;
  const all = Object.keys(tags);
  const shown = showAllFacets ? all : all.filter(f => PRIORITY_FACETS.includes(f));

  root.innerHTML = `
    <p class="sheet-hint">Tap to include. Long-press or right-click to exclude.</p>
    ${shown.map(facet => `
      <div class="facet" data-facet="${facet}">
        <div class="facet-label">${label(facet)}</div>
        <div class="chips">
          ${(tags[facet].values || []).map(v => `
            <button class="chip" data-facet="${facet}" data-value="${v}"
                    data-state="${getChipState(state, facet, v)}">${label(v)}</button>`).join('')}
        </div>
      </div>`).join('')}
    <button class="more-btn">${showAllFacets ? '− fewer filters' : `+ ${all.length - shown.length} more filters`}</button>
    ${hasActiveFilters(state) ? '<button class="more-btn clear-all">clear all</button>' : ''}`;
}

// ---------------------------------------------------------------- apply

function apply({ animate }) {
  const { recipes } = window.cookbook;
  const matched = new Set(filterRecipes(recipes, state).map(r => r.id));

  const first = animate ? measure() : null;

  lineEls.forEach((el, id) => { el.hidden = !matched.has(id); });
  sectionEls.forEach(sec => {
    sec.hidden = ![...sec.querySelectorAll('.line')].some(l => !l.hidden);
    const head = sec.querySelector('.section-head .n');
    if (head) head.textContent = String([...sec.querySelectorAll('.line:not([hidden])')].length).padStart(2, '0');
  });

  if (animate && first) flip(first);

  chrome(matched.size, recipes.length);
}

function measure() {
  const m = new Map();
  lineEls.forEach((el, id) => { if (!el.hidden) m.set(id, el.getBoundingClientRect().top); });
  return m;
}

function flip(first) {
  lineEls.forEach((el, id) => {
    if (el.hidden) return;
    const from = first.get(id);
    if (from === undefined) return;                 // newly revealed: no slide
    const dy = from - el.getBoundingClientRect().top;
    if (Math.abs(dy) < 1) return;

    el.dataset.flip = '';
    el.style.transform = `translateY(${dy}px)`;
    requestAnimationFrame(() => {
      el.style.transform = '';
      el.addEventListener('transitionend', () => {
        delete el.dataset.flip;
        el.style.transform = '';
      }, { once: true });
    });
  });
}

function chrome(shown, total) {
  const root = document.querySelector('.menu-view');
  if (!root) return;

  root.querySelector('.filter-count').textContent =
    shown === total ? `${total} dishes` : `${shown} of ${total}`;

  root.querySelector('.pills').innerHTML = activeList(state).map(p => `
    <button class="pill" data-facet="${p.facet}" data-value="${p.value}" data-state="${p.state}">
      ${label(p.value)} <span class="x" aria-hidden="true">×</span>
    </button>`).join('');

  root.querySelectorAll('.sheet .chip').forEach(c => {
    c.dataset.state = getChipState(state, c.dataset.facet, c.dataset.value);
  });

  const empty = root.querySelector('.board .empty-state');
  if (shown === 0 && !empty) {
    root.querySelector('.board').insertAdjacentHTML('beforeend',
      '<p class="empty-state">Nothing matches. Loosen a filter.</p>');
  } else if (shown > 0 && empty) {
    empty.remove();
  }
}

function stagger(container) {
  container.querySelectorAll('.start-card').forEach(el => { el.dataset.enter = ''; });
  const visible = [...lineEls.values()].filter(el => !el.hidden).slice(0, 20);
  visible.forEach((el, i) => { el.style.setProperty('--i', i); el.dataset.enter = ''; });
  setTimeout(() => {
    container.querySelectorAll('[data-enter]').forEach(el => { delete el.dataset.enter; });
  }, 1400);
}

// ---------------------------------------------------------------- events

function wire(container) {
  const sheet = container.querySelector('.sheet');
  const btn = container.querySelector('.filter-btn');

  btn.addEventListener('click', () => {
    sheetOpen = !sheetOpen;
    sheet.hidden = !sheetOpen;
    btn.setAttribute('aria-expanded', String(sheetOpen));
    btn.textContent = sheetOpen ? 'FILTER −' : 'FILTER +';
  });

  container.querySelectorAll('.start-card').forEach(card => {
    card.addEventListener('click', () => {
      mergeQuery(state, JSON.parse(card.dataset.query));   // merge, never replace
      apply({ animate: true });
      buildSheet(container.querySelector('.sheet-inner'));
      wireSheet(container);
    });
  });

  wireSheet(container);

  container.querySelector('.pills').addEventListener('click', e => {
    const pill = e.target.closest('.pill');
    if (!pill) return;
    toggleFilterChip(state, pill.dataset.facet, pill.dataset.value,
      pill.dataset.state === 'excluded' ? 'exclude' : 'include');
    apply({ animate: true });
  });

  // Shared-element morph target, set just before navigation.
  container.querySelectorAll('.line').forEach(el => {
    el.addEventListener('click', () => {
      el.style.setProperty('--vt-no', 'vt-no');
      el.style.setProperty('--vt-name', 'vt-name');
    });
  });
}

function wireSheet(container) {
  const root = container.querySelector('.sheet-inner');

  root.querySelectorAll('.chip').forEach(chip => {
    let timer = null, longPressed = false;

    const exclude = () => {
      longPressed = true;
      toggleFilterChip(state, chip.dataset.facet, chip.dataset.value, 'exclude');
      apply({ animate: true });
      if (navigator.vibrate) navigator.vibrate(12);
    };

    chip.addEventListener('pointerdown', () => {
      longPressed = false;
      timer = setTimeout(exclude, 450);
    });
    ['pointerup', 'pointerleave', 'pointercancel', 'pointermove']
      .forEach(ev => chip.addEventListener(ev, () => clearTimeout(timer)));

    chip.addEventListener('contextmenu', e => { e.preventDefault(); exclude(); });

    chip.addEventListener('click', () => {
      if (longPressed) { longPressed = false; return; }
      toggleFilterChip(state, chip.dataset.facet, chip.dataset.value, 'include');
      apply({ animate: true });
    });
  });

  const more = root.querySelector('.more-btn:not(.clear-all)');
  if (more) more.addEventListener('click', () => {
    showAllFacets = !showAllFacets;
    buildSheet(root);
    wireSheet(container);
    chrome(filterRecipes(window.cookbook.recipes, state).length, window.cookbook.recipes.length);
  });

  const clear = root.querySelector('.clear-all');
  if (clear) clear.addEventListener('click', () => {
    clearFilters(state);
    apply({ animate: true });
    buildSheet(root);
    wireSheet(container);
  });
}

export { state as filterState };
