// Recipe view - the detail page for a single dish.
// Renders: header, decide zone, ingredients (scalable), steps, variants,
// rescues, related dishes, drink pairings, host notes.

export function renderRecipe(container, id, param) {
  const { recipes, graph } = window.cookbook;
  const r = recipes.find(x => x.id === id);
  if (!r) {
    container.innerHTML = `<div class="recipe-view"><p class="empty-state">Recipe not found.</p><a href="#/" class="btn btn-ghost">Back to menu</a></div>`;
    return;
  }

  let servings = 1;

  const draw = () => {
    container.innerHTML = template(r, servings, graph);
    wire(container, r);
  };
  draw();

  function wire(root, r) {
    // Scaling controls
    root.querySelectorAll('.scale-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        servings = Number(btn.dataset.scale);
        draw();
      });
    });
    // Accordions
    root.querySelectorAll('.accordion-trigger').forEach(t => {
      t.addEventListener('click', () => {
        const body = t.nextElementSibling;
        const open = t.getAttribute('aria-expanded') === 'true';
        t.setAttribute('aria-expanded', String(!open));
        body.hidden = open;
      });
    });
  }
}

function template(r, servings, graph) {
  const isDrink = (r.tags.meal || []).includes('drink');
  const active = r.time?.active_min || 0;
  const passive = r.time?.passive_min || 0;
  const total = active + passive;
  const cleanup = r.cleanup?.vessels ?? 1;

  return `
    <article class="recipe-view">
      <a href="#/" class="btn btn-ghost" style="margin-bottom:1rem">← Back</a>
      <header class="recipe-header">
        <div class="recipe-number">No. ${String(r.no ?? 0).padStart(2,'0')}</div>
        <h1 class="recipe-title">
          <span class="veg-indicator" data-veg="${r.veg}" aria-label="${r.veg ? 'Veg' : 'Non-veg'}" style="vertical-align:0.15em;margin-right:0.5rem"></span>
          ${r.name}
        </h1>
        ${r.tagline ? `<p class="recipe-tagline">${r.tagline}</p>` : ''}
        ${r.aka?.length ? `<p class="recipe-aka">also known as ${r.aka.join(', ')}</p>` : ''}
        <div class="recipe-meta">
          ${r.core ? '<span class="core-badge">● CORE ROTATION</span>' : ''}
          <span>${cuisineLabels(r).join(' · ')}</span>
        </div>
      </header>

      <section class="recipe-decide-zone">
        <div class="macro-strip">
          <div class="macro-item macro-highlight">
            <div class="macro-value">${r.macros.kcal}</div>
            <div class="macro-label">kcal</div>
          </div>
          ${isDrink && r.macros.alcohol_g > 0
            ? `<div class="macro-item"><div class="macro-value">${r.macros.alcohol_g}g</div><div class="macro-label">alcohol</div></div>`
            : `<div class="macro-item"><div class="macro-value">${r.macros.protein_g}g</div><div class="macro-label">protein</div></div>`}
          <div class="macro-item"><div class="macro-value">${r.macros.carbs_g}g</div><div class="macro-label">carbs</div></div>
          <div class="macro-item"><div class="macro-value">${r.macros.fat_g}g</div><div class="macro-label">fat</div></div>
        </div>

        <div class="effort-bar">
          <div class="effort-item"><b>${total}</b> min total ${passive ? `(${active} active, ${passive} passive)` : ''}</div>
          <div class="effort-item"><b>${cleanup}</b> vessel${cleanup === 1 ? '' : 's'} to wash</div>
          ${r.tags.effort?.[0] ? `<div class="effort-item"><b>${cap(r.tags.effort[0])}</b></div>` : ''}
        </div>

        ${r.spice?.level ? `
          <div class="spice-dial">
            Spice: ${'●'.repeat(r.spice.level)}${'○'.repeat(3 - r.spice.level)}
            ${r.spice.dial_up ? ` · Dial up: ${r.spice.dial_up}` : ''}
            ${r.spice.dial_down ? ` · Dial down: ${r.spice.dial_down}` : ''}
          </div>` : ''}

        <div class="tag-chips">
          ${flatTags(r).slice(0, 8).map(t => `<span class="chip chip-small" data-state="included">${cap(t)}</span>`).join('')}
        </div>

        <div class="recipe-actions">
          <a href="#/cook/${r.id}" class="btn btn-primary">Cook now →</a>
          <a href="#/" class="btn btn-ghost">Back to menu</a>
        </div>
      </section>

      <div class="accordions">
        <section class="accordion">
          <button class="accordion-trigger" aria-expanded="true">
            Ingredients <span class="accordion-icon">−</span>
          </button>
          <div class="accordion-content">
            <div class="scaler">
              <span class="text-margin">Scale:</span>
              ${[1, 2, 4].map(s => `<button class="scale-btn" data-scale="${s}" data-active="${s === servings}">${s}×</button>`).join('')}
            </div>
            <ul class="ingredient-list">
              ${(r.ingredients || []).map(i => `
                <li class="ingredient-item">
                  <span class="ingredient-qty">${scaleDisplay(i, servings)}</span>
                  <span class="ingredient-name">${i.display || i.ref}</span>
                  ${i.sub ? `<span class="ingredient-sub">— sub: ${i.sub}</span>` : ''}
                </li>`).join('')}
            </ul>
          </div>
        </section>

        <section class="accordion">
          <button class="accordion-trigger" aria-expanded="true">
            Steps <span class="accordion-icon">−</span>
          </button>
          <div class="accordion-content">
            <ol class="steps-list">
              ${(r.steps || []).map((s, i) => `
                <li class="step-item">
                  <div class="step-title">${i + 1}. ${s.title}</div>
                  <div>${s.text}</div>
                  ${s.cue ? `<div class="step-cue">${s.cue}</div>` : ''}
                  ${s.timer_s ? `<div class="step-timer">⏱ ${fmtTime(s.timer_s)}</div>` : ''}
                </li>`).join('')}
            </ol>
          </div>
        </section>

        ${r.variants?.length ? `
          <section class="accordion">
            <button class="accordion-trigger" aria-expanded="false">
              Variants <span class="accordion-icon">+</span>
            </button>
            <div class="accordion-content" hidden>
              <ul class="variants-block">
                ${r.variants.map(v => `
                  <li class="variant-item">
                    <div class="variant-name">${v.name}</div>
                    <div class="variant-swaps">${v.swaps || v.swap || ''}</div>
                  </li>`).join('')}
              </ul>
            </div>
          </section>` : ''}

        ${r.rescues?.length ? `
          <section class="accordion">
            <button class="accordion-trigger" aria-expanded="false">
              When it goes wrong <span class="accordion-icon">+</span>
            </button>
            <div class="accordion-content" hidden>
              <ul class="rescues">
                ${r.rescues.map(rc => `
                  <li class="rescue-item">
                    <strong>${rc.problem}</strong>
                    <div>${rc.fix}</div>
                  </li>`).join('')}
              </ul>
            </div>
          </section>` : ''}

        ${(r.rel?.pairs_with?.length || r.rel?.similar_to?.length || r.rel?.drink?.length) ? `
          <section class="accordion">
            <button class="accordion-trigger" aria-expanded="false">
              Goes well with <span class="accordion-icon">+</span>
            </button>
            <div class="accordion-content" hidden>
              <div class="related-links">
                ${relatedGroup('Pair with', r.rel.pairs_with)}
                ${relatedGroup('Similar', r.rel.similar_to)}
                ${relatedGroup('Drink', r.rel.drink)}
              </div>
            </div>
          </section>` : ''}

        ${r.rel?.leftovers_become?.length ? `
          <section class="accordion">
            <button class="accordion-trigger" aria-expanded="false">
              Leftovers become <span class="accordion-icon">+</span>
            </button>
            <div class="accordion-content" hidden>
              <div class="leftovers-info">
                ${r.leftovers?.days ? `<p><strong>Keeps:</strong> ${r.leftovers.days} day${r.leftovers.days === 1 ? '' : 's'}</p>` : ''}
                ${r.leftovers?.reheat ? `<p><strong>Reheat:</strong> ${r.leftovers.reheat}</p>` : ''}
                <ul class="leftovers-become">
                  ${r.rel.leftovers_become.map(l => {
                    const target = window.cookbook.recipes.find(x => x.id === l.into);
                    return `<li><a href="#/recipe/${l.into}" class="leftover-link">→ ${target?.name || l.into}</a> ${l.note ? `<span class="text-margin">${l.note}</span>` : ''}</li>`;
                  }).join('')}
                </ul>
              </div>
            </div>
          </section>` : ''}

        ${r.host?.call_it || r.host?.plating || r.host?.prep_ahead ? `
          <section class="accordion">
            <button class="accordion-trigger" aria-expanded="false">
              When hosting <span class="accordion-icon">+</span>
            </button>
            <div class="accordion-content" hidden>
              <div class="lore-block">
                ${r.host.call_it ? `<div class="lore-heading">CALL IT</div><div class="lore-note">${r.host.call_it}</div>` : ''}
                ${r.host.plating ? `<div class="lore-heading">PLATING</div><div class="lore-note">${r.host.plating}</div>` : ''}
                ${r.host.prep_ahead ? `<div class="lore-heading">PREP AHEAD</div><div class="lore-note">${r.host.prep_ahead}</div>` : ''}
              </div>
            </div>
          </section>` : ''}
      </div>
    </article>`;
}

function relatedGroup(label, ids) {
  if (!ids?.length) return '';
  const items = ids
    .map(id => window.cookbook.recipes.find(x => x.id === id))
    .filter(Boolean)
    .slice(0, 8);
  if (!items.length) return '';
  return `
    <div class="related-group">
      <div class="lore-heading">${label}</div>
      ${items.map(x => `
        <a href="#/recipe/${x.id}" class="related-link">
          <span class="veg-indicator" data-veg="${x.veg}" style="vertical-align:0.1em;margin-right:0.4rem"></span>
          ${x.name}
          <span class="related-kcal">${x.macros.kcal} kcal</span>
        </a>`).join('')}
    </div>`;
}

function scaleDisplay(ing, factor) {
  if (factor === 1) return '';
  const g = ing.qty_g;
  if (!g) return `${factor}×`;
  const scaled = g * factor;
  return scaled >= 1000 ? `${(scaled / 1000).toFixed(1)} kg` : `${Math.round(scaled)} g`;
}

function cuisineLabels(r) {
  const meal = r.tags.meal?.[0];
  const cuisine = r.tags.cuisine?.[0];
  return [meal, cuisine].filter(Boolean).map(cap);
}

function flatTags(r) {
  const out = [];
  for (const facet of ['occasion', 'nutrition', 'flavor', 'texture', 'mood']) {
    for (const v of (r.tags[facet] || [])) out.push(v);
  }
  return out;
}

function cap(s) {
  return String(s).split('-').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ');
}

function fmtTime(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}
