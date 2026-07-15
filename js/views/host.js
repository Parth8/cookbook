// Host - date menus and party spreads. Not new recipes: curated flows over
// existing cards, plus the runsheet, which is the actual product here.

let menus = null;

const byId = id => window.cookbook.recipes.find(r => r.id === id);

export async function renderHost(container) {
  if (!menus) {
    try {
      menus = await fetch('data/host-menus.json').then(r => r.json());
    } catch {
      container.innerHTML = '<p class="error">Could not load host menus.</p>';
      return;
    }
  }

  container.innerHTML = `
    <div class="view-host">
      <div class="view-head">
        <h1>Host</h1>
        <p class="view-description">Four for two, three for six. Every dish already lives in the menu - what's new is the order you cook them in.</p>
      </div>

      <div class="filters" style="border:none">
        <button class="btn btn-ghost kind" data-kind="all" data-active="true">All</button>
        <button class="btn btn-ghost kind" data-kind="date">Date night</button>
        <button class="btn btn-ghost kind" data-kind="party">House party</button>
        <button class="btn btn-ghost print" style="margin-left:auto">Print menu</button>
      </div>

      <div class="host-menus">
        ${menus.map(card).join('')}
      </div>
    </div>`;

  container.querySelectorAll('.kind').forEach(btn => {
    btn.addEventListener('click', () => {
      const k = btn.dataset.kind;
      container.querySelectorAll('.kind').forEach(b => { b.dataset.active = String(b === btn); });
      container.querySelectorAll('.host-card').forEach(c => {
        c.hidden = k !== 'all' && c.dataset.kind !== k;
      });
    });
  });

  container.querySelector('.print').addEventListener('click', () => window.print());
}

function card(m) {
  const dishes = m.courses.flatMap(c => c.ids.map(byId)).filter(Boolean);
  const food = dishes.filter(r => !(r.tags.meal || []).includes('drink'));
  const kcal = food.reduce((n, r) => n + r.macros.kcal, 0);
  const protein = food.reduce((n, r) => n + (r.macros.protein_g || 0), 0);
  const serves = m.serves || 2;

  return `
    <article class="host-card" data-kind="${m.kind}" style="--tab: var(--${m.tab || 'peach'})">
      <header class="host-head">
        <h2 class="host-title">${m.title}</h2>
        <p class="host-sub">${m.sub}</p>
      </header>

      <div class="host-body">
        ${m.courses.map(c => `
          <div class="host-course">
            <div class="host-course-label">${c.label}</div>
            ${c.ids.map(id => {
              const r = byId(id);
              if (!r) return `<div class="host-dish"><span class="host-dish-name">${id}</span><span class="host-dish-meta">missing</span></div>`;
              const drink = (r.tags.meal || []).includes('drink');
              return `
                <a class="host-dish" href="#/recipe/${r.id}">
                  <span class="host-dish-name">
                    <span class="veg-indicator" data-veg="${r.veg}"></span>
                    No. ${String(r.no ?? 0).padStart(2, '0')} &nbsp;${r.name}
                  </span>
                  <span class="host-dish-meta">${r.macros.kcal} kcal${drink ? '' : ` · ${r.macros.protein_g}g P`}</span>
                </a>`;
            }).join('')}
          </div>`).join('')}

        <div class="host-course">
          <div class="host-course-label">Runsheet</div>
          <div class="runsheet">
            ${m.runsheet.map(r => `
              <div class="run-row">
                <span class="run-time">${r.time}</span>
                <span class="run-task">${r.task}</span>
              </div>`).join('')}
          </div>
        </div>

        <div class="host-plate">
          <div class="host-course-label">Plating</div>
          <p class="run-task">${m.plating}</p>
          <p class="lore-note">Call it: ${m.call_it}</p>
          <p class="host-total">Plated, per person: <b>${Math.round(kcal / serves)}</b> kcal · <b>${Math.round(protein / serves)}</b>g protein · serves <b>${serves}</b></p>
        </div>
      </div>
    </article>`;
}
