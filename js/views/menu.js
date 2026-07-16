// Menu board - the animated version.
//
// KEY CHANGES from the previous file:
//
// 1. Start cards TOGGLE. Clicking once applies its query and marks the card
//    active. Clicking again removes exactly what it added.
//
// 2. Filter changes DON'T hard-cut. Old code did `el.hidden = true` on the
//    same frame it FLIPped remaining lines - vanishing was instant, the
//    slide-over animated, everything felt jaggy. New code:
//       (a) measure positions,
//       (b) mark newly-hidden lines [data-leaving] (animates them out),
//       (c) mark newly-shown lines [data-entering] (animates them in),
//       (d) FLIP the rest,
//       (e) after --d-flow ms, apply hidden to the ones that left.
//    All three phases run inside the same frame budget, so everything
//    moves together.
//
// 3. Sections COLLAPSE. Head becomes a button, body uses the
//    grid-template-rows 0fr <-> 1fr trick from motion.css. State
//    persists in localStorage.
//
// 4. Chip and start-card presses fire a one-shot [data-just-toggled] pop.
//
// 5. Board layout is a positioned scrim so FLIP works on transform
//    rather than being fought by CSS `hidden`.

import {
  filterRecipes, createFilterState, toggleFilterChip, getChipState,
  clearFilters, hasActiveFilters, activeList, mergeQuery
} from '../lib/filters.js';

const state = createFilterState();
const collapsed = new Set(JSON.parse(localStorage.getItem('cookbook-collapsed') || '[]'));
let firstPaintDone = false;
let sheetOpen = false;
let showAllFacets = false;

const lineEls = new Map();
let sectionEls = [];
let currentMatched = new Set();

const SECTIONS = [
  { meal: 'breakfast', label: 'Breakfast' },
  { meal: 'lunch',     label: 'Quick Lunches' },
  { meal: 'dinner',    label: 'Mains' },
  { meal: 'soup',      label: 'Soups' },
  { meal: 'snack',     label: 'Snacks' },
  { meal: 'dessert',   label: 'Desserts' },
  { meal: 'side',      label: 'Sides & Pairings' },
  { meal: 'drink', cuisine: 'cafe', label: 'Cafe' },
  { meal: 'drink', cuisine: 'bar',  label: 'Bar' }
];

const ENTRY_POINTS = [
  { id: 'ep-fast',   title: 'I have 20 minutes',     query: { time: ['under-15', 'under-30'] } },
  { id: 'ep-chick',  title: 'I have chicken',        query: { protein: ['chicken'] } },
  { id: 'ep-nocln',  title: 'Zero cleanup',          query: { equipment: ['one-pan'] } },
  { id: 'ep-guest',  title: "Someone's coming over", query: { occasion: ['date-night', 'party'] } },
  { id: 'ep-gym',    title: 'Post-workout',          query: { occasion: ['post-workout'] } },
  { id: 'ep-bar',    title: 'Behind the bar',        query: { cuisine: ['bar'] } }
];

const PRIORITY_FACETS = ['diet', 'protein', 'time', 'cuisine', 'occasion', 'nutrition', 'equipment'];
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
        <button class="filter-btn tap-target" aria-expanded="false">FILTER +</button>
        <span class="pills"></span>
        <span class="filter-count text-mono"></span>
      </div>
      <div class="sheet" hidden><div class="sheet-inner"></div></div>
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

// A start card is "active" iff every value in its query is currently included.
function isStartActive(query) {
  for (const [facet, values] of Object.entries(query)) {
    for (const v of values) if (getChipState(state, facet, v) !== 'included') return false;
  }
  return true;
}

function buildStart(root) {
  const { recipes } = window.cookbook;
  root.innerHTML = ENTRY_POINTS.map((ep, i) => {
    const probe = {};
    for (const [f, vals] of Object.entries(ep.query)) probe[f] = { included: vals, excluded: [] };
    const n = filterRecipes(recipes, probe).length;
    const active = isStartActive(ep.query);
    return `
      <button class="start-card tap-target" data-ep="${ep.id}" data-active="${active}" style="--i:${i}">
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
    const key = sec.meal + (sec.cuisine ? ':' + sec.cuisine : '');
    const isCollapsed = collapsed.has(key);
    return `
      <section class="menu-section" data-meal="${sec.meal}" data-key="${key}" data-collapsed="${isCollapsed}">
        <button class="section-head section-toggle tap-target" aria-expanded="${!isCollapsed}">
          <h2>${sec.label}</h2>
          <span class="n">${String(items.length).padStart(2, '0')}</span>
          <svg class="chev" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <div class="section-body">
          <div class="section-inner">
            ${items.map(r => line(r, i++)).join('')}
          </div>
        </div>
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
            <button class="chip tap-target" data-facet="${facet}" data-value="${v}"
                    data-state="${getChipState(state, facet, v)}">${label(v)}</button>`).join('')}
        </div>
      </div>`).join('')}
    <button class="more-btn">${showAllFacets ? '- fewer filters' : `+ ${all.length - shown.length} more filters`}</button>
    ${hasActiveFilters(state) ? '<button class="more-btn clear-all">clear all</button>' : ''}`;
}

// ---------------------------------------------------------------- apply

function apply({ animate }) {
  const { recipes } = window.cookbook;
  const matched = new Set(filterRecipes(recipes, state).map(r => r.id));

  // Phase 1: measure BEFORE any DOM change (FLIP).
  const positions = animate ? measure() : null;

  // Phase 2: compute what changed relative to last render.
  const nowLeaving = [];
  const nowEntering = [];
  lineEls.forEach((el, id) => {
    const was = currentMatched.has(id);
    const now = matched.has(id);
    if (was && !now) nowLeaving.push(el);
    else if (!was && now) nowEntering.push(el);
  });

  if (animate) {
    // Reveal enterers first so they exist in the DOM for FLIP measurement.
    nowEntering.forEach(el => {
      el.hidden = false;
      el.dataset.entering = '';
    });
    // Mark leavers with the exit state - they stay in flow while animating.
    nowLeaving.forEach(el => { el.dataset.leaving = ''; });
    // FLIP the ones that stayed visible.
    if (positions) flip(positions);
    // After the animation, actually hide the leavers.
    setTimeout(() => {
      nowLeaving.forEach(el => {
        el.hidden = true;
        delete el.dataset.leaving;
      });
      nowEntering.forEach(el => { delete el.dataset.entering; });
    }, 420);   // matches --d-flow (380ms) + a small buffer
  } else {
    lineEls.forEach((el, id) => { el.hidden = !matched.has(id); });
  }

  currentMatched = matched;

  // Section counts update immediately; hiding empty sections waits for the
  // animation so we don't collapse mid-flight.
  const updateSectionEmpty = () => {
    sectionEls.forEach(sec => {
      const visibleLines = [...sec.querySelectorAll('.line')].filter(l => !l.hidden);
      const n = visibleLines.length;
      const counter = sec.querySelector('.section-head .n');
      if (counter) counter.textContent = String(n).padStart(2, '0');
      sec.hidden = n === 0 && hasActiveFilters(state);
    });
  };
  if (animate) setTimeout(updateSectionEmpty, 440); else updateSectionEmpty();

  chrome(matched.size, recipes.length);
}

function measure() {
  const m = new Map();
  lineEls.forEach((el, id) => {
    if (!el.hidden) m.set(id, el.getBoundingClientRect().top);
  });
  return m;
}

function flip(first) {
  lineEls.forEach((el, id) => {
    // Skip lines that are leaving - they animate via [data-leaving] instead.
    if (el.dataset.leaving !== undefined) return;
    if (el.hidden) return;

    const from = first.get(id);
    if (from === undefined) return;   // wasn't visible before, [data-entering] handles it

    const to = el.getBoundingClientRect().top;
    const dy = from - to;
    if (Math.abs(dy) < 1) return;

    el.dataset.flip = '';
    el.style.transform = `translateY(${dy}px)`;
    el.style.transitionDuration = '0ms';

    requestAnimationFrame(() => {
      el.style.transitionDuration = '';
      el.style.transform = '';
      const done = () => {
        delete el.dataset.flip;
        el.style.transform = '';
        el.removeEventListener('transitionend', done);
      };
      el.addEventListener('transitionend', done, { once: true });
    });
  });
}

function chrome(shown, total) {
  const root = document.querySelector('.menu-view');
  if (!root) return;

  root.querySelector('.filter-count').textContent =
    shown === total ? `${total} dishes` : `${shown} of ${total}`;

  const pillsEl = root.querySelector('.pills');
  const before = new Map([...pillsEl.querySelectorAll('.pill')].map(el => [`${el.dataset.facet}:${el.dataset.value}`, el]));
  const activeNow = activeList(state);
  const activeKeys = new Set(activeNow.map(p => `${p.facet}:${p.value}`));

  // Remove pills that no longer apply, with a leave animation
  before.forEach((el, k) => {
    if (!activeKeys.has(k)) {
      el.dataset.leaving = '';
      setTimeout(() => el.remove(), 260);
    }
  });
  // Add pills for anything new
  activeNow.forEach(p => {
    const k = `${p.facet}:${p.value}`;
    if (before.has(k)) return;
    pillsEl.insertAdjacentHTML('beforeend', `
      <button class="pill" data-facet="${p.facet}" data-value="${p.value}" data-state="${p.state}">
        ${label(p.value)} <span class="x" aria-hidden="true">×</span>
      </button>`);
  });

  root.querySelectorAll('.sheet .chip').forEach(c => {
    c.dataset.state = getChipState(state, c.dataset.facet, c.dataset.value);
  });

  // Start-card active states track filter state
  root.querySelectorAll('.start-card').forEach(card => {
    const ep = ENTRY_POINTS.find(x => x.id === card.dataset.ep);
    card.dataset.active = String(ep && isStartActive(ep.query));
  });

  const boardEl = root.querySelector('.board');
  const empty = boardEl.querySelector('.empty-state');
  if (shown === 0 && !empty) {
    boardEl.insertAdjacentHTML('beforeend',
      '<p class="empty-state">Nothing matches. Loosen a filter.</p>');
  } else if (shown > 0 && empty) {
    empty.remove();
  }

  // Clear-all appears/disappears in the sheet based on state
  const sheetInner = root.querySelector('.sheet-inner');
  if (sheetInner && !sheetInner.querySelector('.clear-all') && hasActiveFilters(state)) {
    sheetInner.insertAdjacentHTML('beforeend', '<button class="more-btn clear-all">clear all</button>');
    wireClearAll(root.closest('.wrap') || root, root);
  } else if (sheetInner && !hasActiveFilters(state)) {
    sheetInner.querySelector('.clear-all')?.remove();
  }
}

function stagger(container) {
  container.querySelectorAll('.start-card').forEach((el, i) => {
    el.style.setProperty('--i', i);
    el.dataset.enter = '';
  });
  container.querySelectorAll('.section-head').forEach((el, i) => {
    el.style.setProperty('--i', i * 3);
    el.dataset.enter = '';
  });
  const visible = [...lineEls.values()].filter(el => !el.hidden).slice(0, 20);
  visible.forEach((el, i) => { el.style.setProperty('--i', i + 2); el.dataset.enter = ''; });
  setTimeout(() => {
    container.querySelectorAll('[data-enter]').forEach(el => { delete el.dataset.enter; });
  }, 1600);
}

// ---------------------------------------------------------------- events

function wire(container) {
  const sheet = container.querySelector('.sheet');
  const btn = container.querySelector('.filter-btn');

  btn.addEventListener('click', () => {
    sheetOpen = !sheetOpen;
    sheet.hidden = !sheetOpen;
    btn.setAttribute('aria-expanded', String(sheetOpen));
    btn.textContent = sheetOpen ? 'FILTER -' : 'FILTER +';
    pop(btn);
  });

  // START CARDS toggle. Second click removes exactly what the first added.
  container.querySelectorAll('.start-card').forEach(card => {
    card.addEventListener('click', () => {
      const ep = ENTRY_POINTS.find(x => x.id === card.dataset.ep);
      if (!ep) return;
      const active = isStartActive(ep.query);
      if (active) {
        for (const [f, values] of Object.entries(ep.query)) {
          for (const v of values) toggleFilterChip(state, f, v, 'include');   // include -> off
        }
      } else {
        mergeQuery(state, ep.query);
      }
      pop(card);
      apply({ animate: true });
      buildSheet(container.querySelector('.sheet-inner'));
      wireSheet(container);
    });
  });

  wireSheet(container);
  wireSections(container);

  // Pills remove on click
  container.querySelector('.pills').addEventListener('click', e => {
    const pill = e.target.closest('.pill');
    if (!pill) return;
    toggleFilterChip(state, pill.dataset.facet, pill.dataset.value,
      pill.dataset.state === 'excluded' ? 'exclude' : 'include');
    apply({ animate: true });
    buildSheet(container.querySelector('.sheet-inner'));
    wireSheet(container);
  });

  // Shared-element morph handoff
  container.querySelectorAll('.line').forEach(el => {
    el.addEventListener('click', () => {
      el.style.setProperty('--vt-no', 'vt-no');
      el.style.setProperty('--vt-name', 'vt-name');
    });
  });
}

function wireSections(container) {
  container.querySelectorAll('.section-toggle').forEach(head => {
    head.addEventListener('click', () => {
      const sec = head.closest('.menu-section');
      const key = sec.dataset.key;
      const wasCollapsed = sec.dataset.collapsed === 'true';
      sec.dataset.collapsed = String(!wasCollapsed);
      head.setAttribute('aria-expanded', String(wasCollapsed));
      if (wasCollapsed) collapsed.delete(key); else collapsed.add(key);
      try { localStorage.setItem('cookbook-collapsed', JSON.stringify([...collapsed])); } catch {}
    });
  });
}

function wireSheet(container) {
  const root = container.querySelector('.sheet-inner');
  if (!root) return;

  root.querySelectorAll('.chip').forEach(chip => {
    let timer = null, longPressed = false;

    const exclude = () => {
      longPressed = true;
      toggleFilterChip(state, chip.dataset.facet, chip.dataset.value, 'exclude');
      pop(chip);
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
      pop(chip);
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

  wireClearAll(container, container);
}

function wireClearAll(_scope, container) {
  const clear = container.querySelector('.clear-all');
  if (!clear || clear.dataset.wired) return;
  clear.dataset.wired = '1';
  clear.addEventListener('click', () => {
    clearFilters(state);
    apply({ animate: true });
    buildSheet(container.querySelector('.sheet-inner'));
    wireSheet(container);
  });
}

// One-shot press-swell. CSS handles the animation; we just tag and untag.
function pop(el) {
  el.dataset.justToggled = '';
  setTimeout(() => { delete el.dataset.justToggled; }, 420);
}

export { state as filterState };