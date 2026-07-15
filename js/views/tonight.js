// Tonight - the 15-second path.
// Netflix asks what you're in the mood for, not what film. Three optional
// questions, skip any, get dealt one dish. "Deal me another" reshuffles.

import { filterRecipes } from '../lib/filters.js';

const QUESTIONS = [
  { facet: 'time',    label: 'How much time?',      values: ['under-10', 'under-15', 'under-30'] },
  { facet: 'mood',    label: "What's the mood?",    values: ['lazy', 'comfort', 'healthy', 'fancy', 'indulgent', 'cozy', 'fresh'] },
  { facet: 'protein', label: "What's around?",      values: ['chicken', 'egg', 'paneer', 'tofu', 'dal', 'chickpeas', 'fish', 'vegetarian'] }
];

const answers = {};
let dealt = null;
let lastDealt = [];

const label = v => v.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');

export function renderTonight(container) {
  container.innerHTML = `
    <div class="view-tonight">
      <div class="view-head">
        <h1>Tonight</h1>
        <p class="view-description">Answer what you feel like answering. Skip the rest.</p>
      </div>

      <div class="tonight-q">
        ${QUESTIONS.map(q => `
          <div class="q-block" data-facet="${q.facet}">
            <div class="q-label">${q.label} <span class="q-skip">— optional</span></div>
            <div class="chips">
              ${q.values.map(v => `
                <button class="chip" data-facet="${q.facet}" data-value="${v}"
                        data-state="${answers[q.facet] === v ? 'included' : 'default'}">${label(v)}</button>`).join('')}
            </div>
          </div>`).join('')}
      </div>

      <div class="deal-bar">
        <button class="btn btn-primary deal">Deal me a dish</button>
        <span class="filter-count pool"></span>
      </div>

      <div class="result"></div>
    </div>`;

  container.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const { facet, value } = chip.dataset;
      answers[facet] = answers[facet] === value ? undefined : value;   // tap again = off
      if (!answers[facet]) delete answers[facet];
      container.querySelectorAll(`.chip[data-facet="${facet}"]`).forEach(c => {
        c.dataset.state = answers[facet] === c.dataset.value ? 'included' : 'default';
      });
      updatePool(container);
    });
  });

  container.querySelector('.deal').addEventListener('click', () => deal(container));
  updatePool(container);
  if (dealt) show(container, dealt);
}

function pool() {
  const state = {};
  for (const [facet, value] of Object.entries(answers)) {
    state[facet] = { included: [value], excluded: [] };
  }
  // Never deal a side or a plain ingredient as "dinner".
  return filterRecipes(window.cookbook.recipes, state)
    .filter(r => !(r.tags.meal || []).includes('side'));
}

function updatePool(container) {
  const n = pool().length;
  container.querySelector('.pool').textContent = `${n} dish${n === 1 ? '' : 'es'} fit`;
  container.querySelector('.deal').disabled = n === 0;
}

function deal(container) {
  const options = pool();
  if (!options.length) {
    container.querySelector('.result').innerHTML =
      '<p class="empty-state">Nothing fits all that. Drop an answer.</p>';
    return;
  }
  // Avoid repeating the last few deals so "another" actually feels like another.
  const fresh = options.filter(r => !lastDealt.includes(r.id));
  const from = fresh.length ? fresh : options;
  dealt = from[Math.floor(Math.random() * from.length)];

  lastDealt.push(dealt.id);
  if (lastDealt.length > Math.min(5, options.length - 1)) lastDealt.shift();

  show(container, dealt);
}

function show(container, r) {
  const total = (r.time?.active_min || 0) + (r.time?.passive_min || 0);
  const isDrink = (r.tags.meal || []).includes('drink');

  container.querySelector('.result').innerHTML = `
    <article class="pick">
      <div class="pick-no">No. ${String(r.no ?? 0).padStart(2, '0')}</div>
      <h2 class="pick-name">${r.name}</h2>
      <p class="pick-tagline">${r.tagline || ''}</p>

      <div class="pick-meta">
        <div class="pick-stat"><b>${r.macros.kcal}</b><span class="macro-label">kcal</span></div>
        ${isDrink ? '' : `<div class="pick-stat"><b>${r.macros.protein_g}g</b><span class="macro-label">protein</span></div>`}
        <div class="pick-stat"><b>${total}</b><span class="macro-label">minutes</span></div>
        <div class="pick-stat"><b>${r.cleanup?.vessels ?? 1}</b><span class="macro-label">vessel${(r.cleanup?.vessels ?? 1) === 1 ? '' : 's'}</span></div>
      </div>

      <div class="pick-actions">
        <a class="btn btn-primary" href="#/recipe/${r.id}">Cook this</a>
        <button class="btn btn-ghost again">Deal me another</button>
      </div>
    </article>`;

  container.querySelector('.again').addEventListener('click', () => deal(container));
}
