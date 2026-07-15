// Grocery aggregation. Sums ingredient quantities across a plan and groups
// them the way Blinkit is laid out, so the list maps to how you actually shop.

const GROUPS = [
  { key: 'Dairy & eggs', match: ['paneer', 'yogurt', 'curd', 'milk', 'cheese', 'butter', 'ghee', 'cream', 'egg', 'khoya', 'mascarpone'] },
  { key: 'Meat & fish',  match: ['chicken', 'fish', 'prawn', 'basa', 'rohu', 'keema', 'mutton'] },
  { key: 'Produce',      match: ['onion', 'tomato', 'spinach', 'palak', 'capsicum', 'chilli', 'coriander', 'mint', 'garlic', 'ginger', 'lemon', 'lime', 'cucumber', 'carrot', 'potato', 'mushroom', 'corn', 'avocado', 'banana', 'mango', 'berry', 'lettuce', 'basil', 'methi', 'peas', 'gobi', 'edamame', 'pomegranate', 'spring-onion', 'bell'] },
  { key: 'Pantry',       match: [] }   // everything else
];

function groupFor(ref, name) {
  const hay = `${ref} ${name}`.toLowerCase();
  for (const g of GROUPS) {
    if (g.match.some(m => hay.includes(m))) return g.key;
  }
  return 'Pantry';
}

/**
 * @param entries [{ recipe, servings }]
 * @returns { "Dairy & eggs": [{ ref, name, qty_g, perishable, from: [names] }], ... }
 */
export function buildGroceryList(entries, ingredientsDb) {
  const db = new Map((ingredientsDb || []).map(i => [i.ref, i]));
  const totals = new Map();

  for (const { recipe, servings } of entries) {
    for (const ing of recipe.ingredients || []) {
      const key = ing.ref;
      const add = (ing.qty_g || 0) * (servings || 1);
      if (!totals.has(key)) {
        totals.set(key, {
          ref: key,
          name: db.get(key)?.name || ing.display || key,
          qty_g: 0,
          perishable: ing.perishable ?? db.get(key)?.perishable ?? false,
          from: []
        });
      }
      const t = totals.get(key);
      t.qty_g += add;
      if (!t.from.includes(recipe.name)) t.from.push(recipe.name);
    }
  }

  const grouped = {};
  for (const item of totals.values()) {
    const g = groupFor(item.ref, item.name);
    (grouped[g] ||= []).push(item);
  }
  for (const g of Object.keys(grouped)) {
    grouped[g].sort((a, b) => a.name.localeCompare(b.name));
  }
  return grouped;
}

export function formatQty(g) {
  if (g >= 1000) return `${(g / 1000).toFixed(g % 1000 === 0 ? 0 : 1)} kg`;
  return `${Math.round(g)} g`;
}

/** Plain text, ready to paste into a notes app or a Blinkit search. */
export function groceryToText(grouped) {
  return Object.entries(grouped).map(([group, items]) =>
    `${group.toUpperCase()}\n` + items.map(i => `  ${formatQty(i.qty_g)}  ${i.name}`).join('\n')
  ).join('\n\n');
}
