// Main App - Router and State Management
import { renderMenu } from './views/menu.js';
import { renderTonight } from './views/tonight.js';
import { renderFridge } from './views/fridge.js';
import { renderPlanner } from './views/planner.js';
import { renderHost } from './views/host.js';
import { renderRecipe } from './views/recipe.js';
import { renderCookMode } from './views/cook.js';
import { buildRelationshipGraph } from './lib/rel.js';

// Global state
window.cookbook = {
    recipes: [],
    ingredients: [],
    tags: {},
    graph: {},
    currentView: 'menu',
    mode: 'studio'
};

// Initialize app
async function init() {
    // Load data
    await loadData();
    
    // Setup mode toggle
    setupModeToggle();
    
    // Setup search
    setupSearch();
    
    // Setup router
    setupRouter();
    
    // Setup keyboard shortcuts
    setupKeyboardShortcuts();
    
    // Initial route
    handleRoute();
}

// Load all data files
async function loadData() {
    try {
        const [recipes, ingredients, tags] = await Promise.all([
            fetch('data/recipes.json').then(r => r.json()),
            fetch('data/ingredients.json').then(r => r.json()),
            fetch('data/tags.json').then(r => r.json())
        ]);
        
        window.cookbook.recipes = recipes;
        window.cookbook.ingredients = ingredients;
        window.cookbook.tags = tags;
        window.cookbook.graph = buildRelationshipGraph(recipes);
        
        console.log('✓ Data loaded:', {
            recipes: recipes.length,
            ingredients: ingredients.length,
            tags: Object.keys(tags).length
        });
    } catch (error) {
        console.error('Failed to load data:', error);
    }
}

// Mode toggle (Studio / Reading)
function setupModeToggle() {
    const toggle = document.querySelector('.mode-toggle');
    const savedMode = localStorage.getItem('cookbook-mode') || 'studio';
    
    setMode(savedMode);
    
    toggle.addEventListener('click', () => {
        const newMode = window.cookbook.mode === 'studio' ? 'reading' : 'studio';
        setMode(newMode);
        localStorage.setItem('cookbook-mode', newMode);
    });
}

function setMode(mode) {
    window.cookbook.mode = mode;
    document.documentElement.setAttribute('data-mode', mode);
}

// Search functionality
function setupSearch() {
    const trigger = document.querySelector('.search-trigger');
    const modal = document.querySelector('.search-modal');
    const input = document.querySelector('.search-input');
    
    trigger.addEventListener('click', () => {
        modal.hidden = false;
        input.focus();
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.hidden = true;
        }
        // Navigating to a result should also dismiss the modal
        if (e.target.closest('.search-result')) {
            modal.hidden = true;
            input.value = '';
            document.querySelector('.search-results').innerHTML = '';
        }
    });
    
    input.addEventListener('input', (e) => {
        handleSearch(e.target.value);
    });
}

function handleSearch(query) {
    if (!query.trim()) {
        document.querySelector('.search-results').innerHTML = '';
        return;
    }
    
    const results = searchRecipes(query);
    renderSearchResults(results, query.toLowerCase());
}

function searchRecipes(query) {
    const q = query.toLowerCase();
    const { recipes, tags } = window.cookbook;
    
    // Search names, aka aliases (the "chicken katsu -> chicken parmesan" path),
    // and taglines
    const nameMatches = recipes.filter(r =>
        r.name.toLowerCase().includes(q) ||
        (r.aka || []).some(a => a.toLowerCase().includes(q)) ||
        (r.tagline || '').toLowerCase().includes(q)
    );
    
    // Search in tag values
    const tagMatches = new Set();
    Object.entries(tags).forEach(([facet, config]) => {
        config.values.forEach(value => {
            if (value.includes(q)) {
                recipes.forEach(r => {
                    if (r.tags[facet]?.includes(value)) {
                        tagMatches.add(r);
                    }
                });
            }
        });
    });
    
    // Combine and dedupe
    return [...new Set([...nameMatches, ...tagMatches])].slice(0, 10);
}

function renderSearchResults(results, q = '') {
    const container = document.querySelector('.search-results');
    
    if (results.length === 0) {
        container.innerHTML = '<p class="search-empty">No results found</p>';
        return;
    }
    
    container.innerHTML = results.map(recipe => {
        // If the name itself didn't match, show which alias did -
        // "chicken katsu" should visibly lead to Chicken Parmesan
        const nameMatched = recipe.name.toLowerCase().includes(q);
        const matchedAlias = !nameMatched && q
            ? (recipe.aka || []).find(a => a.toLowerCase().includes(q))
            : null;
        
        return `
            <a href="#/recipe/${recipe.id}" class="search-result">
                <div class="search-result-name">
                    <span class="veg-indicator" data-veg="${recipe.veg}"></span>
                    ${recipe.name}
                    ${matchedAlias ? `<span class="search-result-aka text-margin">aka ${matchedAlias}</span>` : ''}
                </div>
                <div class="search-result-meta text-mono">
                    ${recipe.macros.kcal} kcal · ${(recipe.macros.alcohol_g || 0) > 0
                        ? `${recipe.macros.alcohol_g}g alcohol`
                        : `${recipe.macros.protein_g}g protein`}
                </div>
            </a>
        `;
    }).join('');
}

// Router
function setupRouter() {
    window.addEventListener('hashchange', handleRoute);
    window.addEventListener('popstate', handleRoute);
}

function handleRoute() {
    const hash = window.location.hash.slice(1) || '/';
    const [, view, ...params] = hash.split('/');
    
    // Update active nav
    document.querySelectorAll('.nav-link, .tab-item').forEach(link => {
        const linkView = link.dataset.view;
        link.dataset.active = (linkView === view || (!view && linkView === 'menu'));
    });
    
    // Render view
    const app = document.getElementById('app');
    
    switch (view) {
        case 'tonight':
            renderTonight(app);
            break;
        case 'fridge':
            renderFridge(app);
            break;
        case 'planner':
            renderPlanner(app);
            break;
        case 'host':
            renderHost(app);
            break;
        case 'recipe':
            if (params[0]) {
                renderRecipe(app, params[0], params[1]); // id, optional accordion
            }
            break;
        case 'cook':
            if (params[0]) {
                renderCookMode(app, params[0]);
            }
            break;
        default:
            renderMenu(app);
    }
    
    // Scroll to top
    window.scrollTo(0, 0);
}

// Keyboard shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Cmd/Ctrl + K for search
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            document.querySelector('.search-trigger').click();
        }
        
        // Escape to close search
        if (e.key === 'Escape') {
            const modal = document.querySelector('.search-modal');
            if (!modal.hidden) {
                modal.hidden = true;
            }
        }
    });
}

// Start the app
init();

// Export utilities
export { handleRoute };
