#!/usr/bin/env python3
"""Data QA for the cookbook.

Checks recipes.json / ingredients.json / tags.json for:
  - schema completeness and unique ids/numbers
  - ingredient refs and relationship targets that resolve
  - tag facets/values that exist in the taxonomy
  - macro identity (kcal ~ 4P + 4C + 9F + 7A, within 10%)
  - stated macros vs macros computed from the ingredient db (within 15%)
  - drink cards carrying strength tags, lore, and alcohol data
  - near-duplicate dishes via ingredient-set Jaccard + name-token overlap

Run: python3 scripts/validate.py
Exit code 0 = clean (warnings allowed), 1 = errors found.
"""
import json
import sys
from itertools import combinations
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
errors = []
warnings = []


def err(msg):
    errors.append(msg)


def warn(msg):
    warnings.append(msg)


def load(name):
    try:
        return json.load(open(ROOT / 'data' / name))
    except json.JSONDecodeError as e:
        err(f"{name}: invalid JSON - {e}")
        sys.exit(f"FATAL: {name} failed to parse")


recipes = load('recipes.json')
ingredients = load('ingredients.json')
tags = load('tags.json')

ing_by_ref = {i['ref']: i for i in ingredients}
recipe_ids = {r['id'] for r in recipes}

# ---------- uniqueness ----------
seen_ids, seen_nos = set(), {}
for r in recipes:
    if r['id'] in seen_ids:
        err(f"duplicate recipe id: {r['id']}")
    seen_ids.add(r['id'])
    if r.get('no') is not None:
        if r['no'] in seen_nos:
            err(f"duplicate recipe number {r['no']}: {r['id']} and {seen_nos[r['no']]}")
        seen_nos[r['no']] = r['id']

seen_refs = set()
for i in ingredients:
    if i['ref'] in seen_refs:
        err(f"duplicate ingredient ref: {i['ref']}")
    seen_refs.add(i['ref'])

# ---------- per-recipe checks ----------
REQUIRED = ['id', 'no', 'name', 'tagline', 'core', 'veg', 'tags', 'time',
            'cleanup', 'macros', 'cost_band', 'rel', 'ingredients', 'steps']

for r in recipes:
    rid = r.get('id', '<missing id>')

    for field in REQUIRED:
        if field not in r:
            err(f"{rid}: missing required field '{field}'")

    # tags exist in taxonomy
    for facet, values in r.get('tags', {}).items():
        if facet not in tags:
            err(f"{rid}: unknown tag facet '{facet}'")
            continue
        for v in values:
            if v not in tags[facet]['values']:
                err(f"{rid}: unknown value '{v}' in facet '{facet}'")

    # ingredient refs resolve; perishable flags agree with the db
    for ing in r.get('ingredients', []):
        ref = ing['ref']
        if ref not in ing_by_ref:
            err(f"{rid}: ingredient ref '{ref}' not in ingredients.json")
        elif ing.get('perishable') != ing_by_ref[ref].get('perishable'):
            warn(f"{rid}: perishable flag for '{ref}' disagrees with db "
                 f"(recipe={ing.get('perishable')}, db={ing_by_ref[ref].get('perishable')})")

    # relationship targets resolve
    rel = r.get('rel', {})
    for key in ('pairs_with', 'similar_to', 'drink'):
        for target in rel.get(key, []):
            if target not in recipe_ids:
                err(f"{rid}: rel.{key} -> '{target}' does not exist")
    for item in rel.get('leftovers_become', []):
        if item['into'] not in recipe_ids:
            err(f"{rid}: rel.leftovers_become -> '{item['into']}' does not exist")
    if rid in rel.get('similar_to', []) or rid in rel.get('pairs_with', []):
        err(f"{rid}: references itself in rel")

    # steps sanity
    if not r.get('steps'):
        err(f"{rid}: no steps")

    m = r.get('macros', {})

    # serves must be a sane positive integer - per-serving macros divide by it
    serves = r.get('serves', 1)
    if not isinstance(serves, int) or serves < 1:
        err(f"{rid}: serves must be a positive integer, got {serves!r}")
        serves = 1

    # Macros must EQUAL the ingredient database, not merely resemble it.
    # Sum every non-batch-prep line, divide by serves, compare to what the
    # card claims. Anything beyond rounding is a bug, not a difference of
    # opinion. kcal comes from each ingredient's own kcal figure because USDA
    # already applies the right Atwater factors (fibre yields ~2 kcal/g, not 4).
    FIELDS = ['kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'alcohol_g']
    comp = dict.fromkeys(FIELDS, 0.0)
    resolved = True
    for ing in r.get('ingredients', []):
        if ing.get('batch_prep'):
            continue
        db = ing_by_ref.get(ing['ref'])
        if not db:
            resolved = False
            break
        f = ing['qty_g'] / 100.0
        mm = db['macros_per_100g']
        for k in FIELDS:
            comp[k] += (mm.get(k) or 0) * f

    if resolved and comp['kcal'] > 0:
        for k in FIELDS:
            expected = comp[k] / serves
            stated = m.get(k, 0) or 0
            # kcal and gram fields are stored rounded; allow only that much
            tol = 1.0 if k == 'kcal' else 0.55
            if abs(stated - expected) > tol:
                err(f"{rid}: macros.{k} is {stated}, ingredients give "
                    f"{expected:.1f} (serves {serves})")

    # Fibre-aware sanity check. Loose on purpose: USDA applies food-specific
    # Atwater factors, so the generic formula only ever approximates.
    fiber = m.get('fiber_g', 0) or 0
    net_carbs = max((m.get('carbs_g', 0) or 0) - fiber, 0)
    identity = (m.get('protein_g', 0) * 4 + net_carbs * 4 + m.get('fat_g', 0) * 9 +
                (m.get('alcohol_g', 0) or 0) * 7 + fiber * 2)
    if identity > 0:
        diff = abs(m.get('kcal', 0) - identity)
        if diff > max(identity * 0.25, 30):
            warn(f"{rid}: kcal {m.get('kcal')} is far from fibre-aware Atwater "
                 f"{identity:.0f} (diff {diff:.0f}) - check the ingredient entries")

    # Nutrition claims have to survive contact with the numbers.
    #
    # high-protein is protein DENSITY, not a raw gram count: at least 20% of
    # the card's calories come from protein. That is the standard definition
    # and it judges a dal and a chicken breast on the same terms, where a flat
    # gram floor would just delete every vegetarian main. The per-meal gram
    # floors below stay, as a separate informational report.
    nutrition = r.get('tags', {}).get('nutrition', [])
    meal_now = (r.get('tags', {}).get('meal') or [None])[0]
    kcal_now = m.get('kcal', 0) or 0
    if 'high-protein' in nutrition and kcal_now > 0:
        share = m.get('protein_g', 0) * 4 / kcal_now
        if share < 0.20:
            err(f"{rid}: tagged high-protein but protein is only {share:.0%} of "
                f"its {kcal_now} kcal ({m.get('protein_g')}g)")
    if 'high-fiber' in nutrition and (m.get('fiber_g') or 0) < 5:
        err(f"{rid}: tagged high-fiber but only {m.get('fiber_g')}g fibre "
            f"(5g is the bar)")
    # "Low calorie" means something different for a dinner than for a snack.
    cap = 450 if meal_now in ('breakfast', 'lunch', 'dinner', 'soup') else 200
    if 'low-cal' in nutrition and kcal_now > cap:
        err(f"{rid}: tagged low-cal at {kcal_now} kcal ({meal_now} cap is {cap})")
    if 'low-fat' in nutrition and m.get('fat_g', 0) > 15:
        err(f"{rid}: tagged low-fat with {m.get('fat_g')}g fat")

    # aka aliases: every card should answer to at least one alternate name
    aka = r.get('aka')
    if aka is None:
        warn(f"{rid}: no aka aliases - search misses its other names")
    elif not (isinstance(aka, list) and all(isinstance(a, str) and a.strip() for a in aka)):
        err(f"{rid}: aka must be a list of non-empty strings")

    # drink-specific rules
    meal = r.get('tags', {}).get('meal', [])
    if 'drink' in meal:
        strength = r.get('tags', {}).get('strength', [])
        if not strength:
            err(f"{rid}: drink without a strength tag")
        if not r.get('tags', {}).get('temp'):
            err(f"{rid}: drink without a temp tag (hot/cold)")
        cuisine = r.get('tags', {}).get('cuisine', [])
        if not ('cafe' in cuisine or 'bar' in cuisine):
            err(f"{rid}: drink must carry cuisine 'cafe' or 'bar' to land in a menu section")
        if not r.get('lore'):
            warn(f"{rid}: drink without lore - the fun is the point")
        if strength and strength[0] != 'zero-proof':
            if not m.get('alcohol_g'):
                err(f"{rid}: alcoholic drink missing macros.alcohol_g")
            # The house pour is 60ml. At 40% ABV that is 133 kcal before a
            # drop of anything else, so the old 180 budget left ~12g of sugar
            # for the whole rest of the drink - unreachable for any sour once
            # the macros were computed honestly rather than estimated. 220
            # is the real line: spirit, citrus and a sensible measure of syrup.
            if m.get('kcal', 999) > 220:
                warn(f"{rid}: cocktail over the 220 kcal budget ({m.get('kcal')})")
        if strength and strength[0] == 'zero-proof' and m.get('alcohol_g'):
            err(f"{rid}: zero-proof drink has alcohol_g set")
        # egg white in a drink means it cannot be marked veg
        refs = {i['ref'] for i in r.get('ingredients', [])}
        if 'egg-white' in refs and r.get('veg') is True:
            err(f"{rid}: contains egg white but is marked veg")

# ---------- protein floor report (informational) ----------
FLOORS = {'breakfast': 25, 'lunch': 30, 'dinner': 30, 'snack': 10, 'dessert': 12}
for r in recipes:
    meal = (r.get('tags', {}).get('meal') or [None])[0]
    floor = FLOORS.get(meal)
    if floor and r['macros'].get('protein_g', 0) < floor:
        warn(f"{r['id']}: below the {meal} protein floor "
             f"({r['macros'].get('protein_g')}g < {floor}g)")

# ---------- near-duplicate scan (deduction, not just 1:1) ----------
STOPWORDS = {'chicken', 'the', 'and', 'with', 'a', 'of'}


def name_tokens(r):
    return {t for t in r['name'].lower().replace(',', '').split() if t not in STOPWORDS}


def core_refs(r):
    # Ignore universal aromatics/pantry glue so overlap reflects the dish itself
    GLUE = {'vegetable-oil', 'olive-oil', 'salt', 'sugar', 'garlic', 'onion', 'ginger',
            'water', 'turmeric', 'red-chilli-powder', 'coriander-powder', 'garam-masala',
            'cumin-seeds', 'black-pepper', 'lime', 'lemon', 'coriander-leaves', 'tomato'}
    return {i['ref'] for i in r['ingredients']} - GLUE


dupes = []
for a, b in combinations(recipes, 2):
    if (a['tags'].get('meal') or [None])[0] != (b['tags'].get('meal') or [None])[0]:
        continue
    # A hot drink and its iced twin are intentionally separate cards
    ta, tb = (a['tags'].get('temp') or [None])[0], (b['tags'].get('temp') or [None])[0]
    if ta and tb and ta != tb:
        continue
    ra, rb = core_refs(a), core_refs(b)
    if not ra or not rb:
        continue
    jaccard = len(ra & rb) / len(ra | rb)
    name_overlap = len(name_tokens(a) & name_tokens(b))
    # Tiny ingredient sets (drinks) make overlap cheap - demand more of them
    threshold = 0.75 if min(len(ra), len(rb)) < 4 else 0.65
    if jaccard >= threshold or (jaccard >= 0.5 and name_overlap >= 1):
        def linked(x, y):
            rel = x['rel']
            return (y['id'] in rel.get('similar_to', []) or
                    y['id'] in rel.get('pairs_with', []) or
                    any(item['into'] == y['id'] for item in rel.get('leftovers_become', [])))
        dupes.append((a['id'], b['id'], jaccard, linked(a, b) or linked(b, a)))

# Declared siblings are a design choice; only undeclared overlap needs eyes
declared_pairs = sum(1 for d in dupes if d[3])
for a, b, j, declared in dupes:
    if not declared:
        warn(f"near-duplicate candidate: {a} ~ {b} (ingredient overlap {j:.0%}, UNDECLARED)")

# ---------- summary ----------
drinks = [r for r in recipes if 'drink' in r['tags'].get('meal', [])]
boozy = [r for r in drinks if (r['tags'].get('strength') or [''])[0] != 'zero-proof']
cafe = [r for r in drinks if 'cafe' in r['tags'].get('cuisine', [])]
hot = [r for r in cafe if (r['tags'].get('temp') or [''])[0] == 'hot']
aka_count = sum(len(r.get('aka', [])) for r in recipes)
cuisines = {}
for r in recipes:
    for c in r['tags'].get('cuisine', []):
        cuisines[c] = cuisines.get(c, 0) + 1

print(f"Recipes: {len(recipes)}  (drinks: {len(drinks)} - cafe: {len(cafe)} "
      f"[{len(hot)} hot/{len(cafe)-len(hot)} cold], alcoholic: {len(boozy)})")
print(f"Ingredients: {len(ingredients)}  |  aka aliases: {aka_count}")
print(f"Dedup scan: {len(dupes)} high-overlap pairs, {declared_pairs} declared as siblings")
print(f"Cuisines: {', '.join(f'{k}={v}' for k, v in sorted(cuisines.items()))}")
print()

if errors:
    print(f"ERRORS ({len(errors)}):")
    for e in errors:
        print(f"  ✗ {e}")
if warnings:
    print(f"WARNINGS ({len(warnings)}):")
    for w in warnings:
        print(f"  ~ {w}")
if not errors and not warnings:
    print("All checks passed clean.")

sys.exit(1 if errors else 0)
