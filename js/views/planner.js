// Planner - 14 days, live macro totals, one grocery list.

import { buildGroceryList, formatQty, groceryToText } from '../lib/grocery.js';

const SLOTS = ['breakfast', 'lunch', 'dinner'];
const DAYS = 14;
const KEY = 'cookbook-plan';

let plan = load();
let picking = null;   // { day, slot }

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(plan)); } catch {}
}

const byId = id => window.cookbook.recipes.find(r => r.id === id);
const cap = s => s[0].toUpperCase() + s.slice(1);

function dayDate(i) {
  const d = new Date();
  d.setDate(d.getDate() + i);
  return d;
}

function dayTotals(i) {
  const day = plan[i] || {};
  let kcal = 0, protein = 0;
  for (const slot of SLOTS) {
    const r = day[slot] && byId(day[slot]);
    if (r) { kcal += r.macros.kcal; protein += r.macros.protein_g || 0; }
  }
  return { kcal, protein };
}

export function renderPlanner(container) {
  container.innerHTML = `
    <div class="view-planner">
      <div class="view-head">
        <h1>Plan</h1>
        <p class="view-description">Fourteen days. Tap a slot to fill it. The list adds itself up.</p>
      </div>

      <div class="plan-toolbar">
        <button class="btn btn-primary shop">Build grocery list</button>
        <button class="btn btn-ghost clear">Clear plan</button>
        <span class="filter-count planned"></span>
      </div>

      <div class="plan-grid"></div>
      <div class="grocery-wrap"></div>
    </div>

    <div class="picker-overlay" hidden>
      <div class="picker" role="dialog" aria-label="Pick a dish">
        <div class="picker-head">
          <span class="label picker-slot"></span>
          <button class="btn btn-ghost picker-close">Close</button>
        </div>
        <div class="picker-list"></div>
      </div>
    </div>`;

  drawGrid(container);
  wire(container);
}

function drawGrid(container) {
  const grid = container.querySelector('.plan-grid');

  grid.innerHTML = Array.from({ length: DAYS }, (_, i) => {
    const d = dayDate(i);
    const day = plan[i] || {};
    const t = dayTotals(i);
    const full = SLOTS.every(s => day[s]);

    return `
      <div class="plan-day" data-day="${i}" data-full="${full}">
        <div class="plan-date">
          <span class="plan-dow">${i === 0 ? 'Today' : d.toLocaleDateString('en-IN', { weekday: 'short' })}</span>
          <span class="plan-dnum">${d.getDate()} ${d.toLocaleDateString('en-IN', { month: 'short' })}</span>
        </div>
        <div class="plan-slots">
          ${SLOTS.map(slot => {
            const r = day[slot] && byId(day[slot]);
            return r
              ? `<button class="plan-slot" data-filled="true" data-day="${i}" data-slot="${slot}">
                   ${r.name} <span class="x" aria-hidden="true">×</span>
                 </button>`
              : `<button class="plan-slot" data-day="${i}" data-slot="${slot}">+ ${cap(slot)}</button>`;
          }).join('')}
        </div>
        <div class="plan-totals">${t.kcal ? `<b>${t.kcal}</b> kcal · <b>${t.protein}</b>g P` : '—'}</div>
      </div>`;
  }).join('');

  const filled = Object.values(plan).reduce((n, d) => n + Object.keys(d || {}).length, 0);
  container.querySelector('.planned').textContent = `${filled} meal${filled === 1 ? '' : 's'} planned`;

  grid.querySelectorAll('.plan-slot').forEach(btn => {
    btn.addEventListener('click', () => {
      const { day, slot } = btn.dataset;
      if (btn.dataset.filled === 'true') {
        delete plan[day][slot];
        if (!Object.keys(plan[day]).length) delete plan[day];
        save(); drawGrid(container);
      } else {
        openPicker(container, day, slot);
      }
    });
  });
}

function openPicker(container, day, slot) {
  picking = { day, slot };
  const overlay = container.querySelector('.picker-overlay');
  const list = container.querySelector('.picker-list');

  container.querySelector('.picker-slot').textContent = `${cap(slot)} · Day ${Number(day) + 1}`;

  const options = window.cookbook.recipes
    .filter(r => (r.tags.meal || []).includes(slot))
    .sort((a, b) => (b.core === true) - (a.core === true) || (a.no ?? 999) - (b.no ?? 999));

  list.innerHTML = options.map(r => `
    <button class="picker-item" data-id="${r.id}">
      <span class="picker-name">
        <span class="veg-indicator" data-veg="${r.veg}"></span>
        ${r.name}${r.core ? ' <span class="core">●</span>' : ''}
      </span>
      <span class="picker-meta">${r.macros.kcal} kcal · ${r.macros.protein_g}g P</span>
    </button>`).join('') || '<p class="search-empty">Nothing tagged for this slot.</p>';

  list.querySelectorAll('.picker-item').forEach(item => {
    item.addEventListener('click', () => {
      (plan[picking.day] ||= {})[picking.slot] = item.dataset.id;
      save();
      overlay.hidden = true;
      drawGrid(container);
    });
  });

  overlay.hidden = false;
}

function wire(container) {
  const overlay = container.querySelector('.picker-overlay');
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.hidden = true; });
  container.querySelector('.picker-close').addEventListener('click', () => { overlay.hidden = true; });

  container.querySelector('.clear').addEventListener('click', () => {
    plan = {}; save(); drawGrid(container);
    container.querySelector('.grocery-wrap').innerHTML = '';
  });

  container.querySelector('.shop').addEventListener('click', () => shop(container));
}

function shop(container) {
  const entries = [];
  for (const day of Object.values(plan)) {
    for (const id of Object.values(day || {})) {
      const r = byId(id);
      if (!r) continue;
      const hit = entries.find(e => e.recipe.id === id);
      if (hit) hit.servings += 1; else entries.push({ recipe: r, servings: 1 });
    }
  }

  const wrap = container.querySelector('.grocery-wrap');
  if (!entries.length) {
    wrap.innerHTML = '<p class="empty-state">Plan something first.</p>';
    return;
  }

  const grouped = buildGroceryList(entries, window.cookbook.ingredients);

  wrap.innerHTML = `
    <div class="grocery">
      <div class="plan-toolbar" style="padding-bottom:0">
        <h2>Grocery list</h2>
        <button class="btn btn-ghost copy">Copy</button>
      </div>
      ${Object.entries(grouped).map(([group, items]) => `
        <div class="grocery-group">
          <div class="label">${group}</div>
          ${items.map(i => `
            <div class="grocery-item">
              <span><span class="grocery-qty">${formatQty(i.qty_g)}</span> &nbsp;${i.name}</span>
              <span class="picker-meta">${i.from.length} dish${i.from.length === 1 ? '' : 'es'}</span>
            </div>`).join('')}
        </div>`).join('')}
    </div>`;

  wrap.querySelector('.copy').addEventListener('click', async e => {
    try {
      await navigator.clipboard.writeText(groceryToText(grouped));
      e.target.textContent = 'Copied';
      setTimeout(() => { e.target.textContent = 'Copy'; }, 1600);
    } catch { e.target.textContent = 'Copy failed'; }
  });

  wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
