# Parth's Cookbook

A personal high-protein cookbook and bar - a retrieval-first static site for answering "what should I cook tonight?" (and "what should I pour with it?")

## Current Roster

**216 recipe cards**, 58 in core rotation.

| Section | Count |
|---|---|
| Breakfast | 19 |
| Quick Lunches | 18 |
| Soups | 5 |
| Mains | 62 |
| Snacks | 7 |
| Desserts | 12 |
| Sides & Pairings | 13 |
| Café | 27 (9 hot / 18 cold) |
| Bar | 53 |
| **Total** | **216** |

228 ingredients, 421 aka aliases, 0 broken refs. Run `python3 scripts/validate.py` before deploy — it must exit 0.

Highlights now in as real cards (not just aliases): **Chicken Katsu**, **Chilli Chicken**, **Chicken Alfredo**, **Pink Sauce Pasta**, **Skillet Lasagna**, **Shakshuka**, **Dal Makhani**, **Souvlaki**, **Gulab Jamun**, **Protein Tiramisu**, **Salted Lassi**, **Iced Lemon Tea**, plus all five soups and ten sides from the plan.

## Features

- **6 Entry Points**: Start from context (time, ingredients, cleanup, guests, post-workout, behind the bar) not chapters
- **Collapsed-by-default board**: The menu opens as a one-screen index of all nine sections. Click a section head to unfold it; applying a filter unfolds whatever holds results, and `EXPAND ALL` opens everything at once. Your own open/closed choices persist in localStorage
- **Faceted Filtering**: AND across facets, OR within, with tri-state chips - including temp (hot/cold) and drink strength (zero-proof / light pour / strong pour)
- **Alias Search**: `aka` fields make every card findable by its other names, including near-miss dishes ("chicken katsu" → Chicken Parmesan) with the swap spelled out
- **Fridge Matcher**: Tap what you have, get ranked recipes with honest set math
- **Cook Mode**: Full-screen step player with a progress rail, pausable timers, screen wake lock, and arrow-key / swipe navigation (drinks get Pour Mode)
- **Command Palette**: ⌘K / Ctrl-K search over names, aliases and taglines, fully keyboard-driven
- **Progressive Disclosure**: Recipe cards unfold from menu line → full detail
- **Relationship Graph**: Pairs-with, similar-to, leftovers-become, drink pairings, computed backlinks - rendered as a Related accordion on every card
- **Lore**: "Worth knowing" fact blocks so the site reads like a bar conversation, not a textbook

## Stack

- No build step - hand-rolled HTML + CSS + ES modules
- ES6 modules with hash routing
- Data in JSON, views as pure functions
- CDN only: rough.js for sketch wobble
- Progressive enhancement: View Transitions API, Wake Lock API

## Local Development

1. Clone the repo
2. Serve with any static server:

```bash
# Python
python3 -m http.server 8000

# Node
npx serve

# PHP
php -S localhost:8000
```

3. Open http://localhost:8000

## Project Structure

```
cookbook/
├── index.html              # Single shell, hash-routed
├── css/
│   ├── tokens.css          # Design tokens (Studio/Reading modes)
│   ├── base.css            # Base styles and typography
│   ├── components.css      # Component styles
│   └── motion.css          # Animations and transitions
├── js/
│   ├── app.js              # Router, state, initialization
│   ├── lib/
│   │   ├── filters.js      # Faceted filtering engine
│   │   ├── match.js        # Fridge matcher logic
│   │   ├── macros.js       # Macro calculations
│   │   ├── grocery.js      # Plan -> grouped, summed shopping list
│   │   └── rel.js          # Relationship graph builder
│   └── views/
│       ├── menu.js         # Start strip + board + filters
│       ├── recipe.js       # Recipe detail with accordions
│       ├── cook.js         # Cook mode (full screen, keyboard + swipe)
│       ├── fridge.js       # Fridge matcher
│       ├── tonight.js      # Three-question dish picker
│       ├── planner.js      # 14-day meal planner + grocery list
│       └── host.js         # Date/party menus with runsheets
├── data/
│   ├── recipes.json        # Full roster (216 cards)
│   ├── ingredients.json    # 228 ingredients with macros per 100g
│   ├── host-menus.json     # Curated date/party menus + runsheets
│   └── tags.json           # Controlled vocabulary (15 facets incl. temp, diet)
├── scripts/
│   ├── validate.py         # Data QA: refs, tags, rel graph, macro identity, dedup scan
│   └── build_gap.py        # Idempotent gap-filler (re-run safe)
└── assets/
    └── sketches/           # SVG sketches (to be added)
```

## QA

```bash
python3 scripts/validate.py
```

Checks every ingredient ref, tag value, and relationship id; verifies stated macros against the 4P + 4C + 9F + 7A identity (alcohol counts its 7 kcal/g) and against macros recomputed from `ingredients.json`; enforces drink rules (strength tag, alcohol_g, the 180 kcal cocktail budget); and runs a near-duplicate scan using ingredient-set overlap so redundant dishes get caught even when the names differ.

## Data Architecture

The system is built as **retrieval-first**:

```
data/recipes.json + tags.json + ingredients.json  (assets)
        |
   lib/ (filters, matching, macros, overlaps)     (semantic layer)
        |
   views/ (menu, tonight, fridge, planner, host)  (lenses)
```

Every view is a query. Adding a lens never touches the data.

## Design

One design, no mode toggle. Palette is **newsprint**: warm grey paper, near-black
ink, a single vermilion accent. Fraunces (with its SOFT/WONK/opsz axes) carries
display type, Karla carries body and all tabular figures.

Motion is a closed vocabulary defined in `tokens.css` — three easings
(`--ease-fluid`, `--ease-soft`, `--ease-swell`) and three durations
(`--d-quick`, `--d-flow`, `--d-drape`). Nothing invents its own numbers, and
`motion.css` lists every animation on the site. Anything not on that list is a
bug. `prefers-reduced-motion` cuts all of it.

## Responsive

Five bands, all verified in-browser:

| Band | Behaviour |
|---|---|
| ≥1440px | Measure widens to 66rem |
| 1025–1439px | Baseline laptop layout |
| 721–1024px (iPad) | Keeps the top nav, tightens gutters and gaps |
| ≤720px (phone) | Tab bar replaces top nav, leader dots drop, planner days stack, 44px touch targets, safe-area insets |
| ≤420px | Macro strip goes 2×2, buttons go full-width |

Landscape phones get their own height-based rule so the masthead does not eat
the screen.

## Tag Taxonomy

15 facets with closed vocabularies (`diet` is derived at load time from
`veg` + `protein`, the other 14 are authored):

- **diet** *(derived)*: veg, egg-veg, non-veg
- **meal**: breakfast, lunch, soup, dinner, snack, dessert, side, drink
- **cuisine**: north-indian, punjabi, italian, mexican, thai, korean, cafe, bar, etc.
- **temp**: hot, cold (drinks)
- **protein**: chicken, fish, egg, paneer, tofu, dal, vegetarian
- **time**: under-10, under-15, under-30, weekend-project
- **effort**: beginner, intermediate, fancy
- **occasion**: everyday, meal-prep, date-night, party, post-workout
- **nutrition**: high-protein, low-cal, low-fat, gluten-free
- **equipment**: air-fryer, one-pan, no-cook, blender, shaker
- **pantry**: pantry-only, uses-leftover-rice, uses-greek-yogurt
- **strength**: zero-proof, light-pour, strong-pour (drinks)
- **flavor**: creamy, smoky, spicy, tangy, umami, citrusy, bitter, fizzy
- **texture**: crispy, creamy, soft, juicy, saucy, silky, icy
- **mood**: lazy, comfort, healthy, fancy, cozy, fresh, indulgent

Workers pick from this vocabulary, never invent. This keeps retrieval honest.

## Recipe Schema

Each recipe is one JSON object:

```json
{
  "id": "chicken-tikka",
  "no": 26,
  "name": "Chicken Tikka",
  "tagline": "Charred at home, no tandoor required.",
  "core": true,
  "veg": false,
  "tags": { "meal": ["dinner"], "cuisine": ["north-indian"], ... },
  "time": { "active_min": 10, "passive_min": 20 },
  "cleanup": { "vessels": 1, "boards": 1 },
  "aka": ["boneless tandoori bites", "chicken tikka skewers"],
  "macros": { "kcal": 355, "protein_g": 54, "carbs_g": 9, "fat_g": 11 },
  "cost_band": 2,
  "lore": ["Optional fun facts - drinks carry two: one on the drink, one on the spirit"],
  "rel": {
    "pairs_with": ["jeera-rice"],
    "similar_to": ["tandoori-chicken"],
    "leftovers_become": [{ "into": "chicken-wrap", "note": "shred" }],
    "drink": ["whiskey-highball"]
  },
  "ingredients": [...],
  "steps": [...],
  "rescues": [...],
  "leftovers": {...},
  "host": {...}
}
```

Macros are computed from `ingredients.json`, never estimated. Every rel ID must resolve (QA-enforced).

## Browser Support

- Modern evergreen browsers (Chrome, Firefox, Safari, Edge)
- ES6 modules support required
- Progressive enhancement for View Transitions API and Wake Lock API

## License

Personal project - all rights reserved

## Contact

Built for Parth - questions? Reach out at [your-email]
