# GitHub Pages Deployment Guide

## Deployment Folder Structure

For GitHub Pages, your repository should have this structure:

```
cookbook/                    (repository root)
├── index.html              # Entry point for GitHub Pages
├── css/
│   ├── tokens.css
│   ├── base.css
│   ├── components.css
│   └── motion.css
├── js/
│   ├── app.js
│   ├── lib/
│   │   ├── filters.js
│   │   ├── match.js
│   │   ├── macros.js
│   │   └── rel.js
│   └── views/
│       ├── menu.js
│       ├── recipe.js
│       ├── cook.js
│       ├── fridge.js
│       ├── tonight.js
│       ├── planner.js
│       └── host.js
├── data/
│   ├── recipes.json
│   ├── ingredients.json
│   └── tags.json
├── assets/
│   └── sketches/           # SVG sketches (add later)
├── README.md
├── DEPLOYMENT.md           # This file
└── .gitignore
```

## GitHub Repository Setup

### 1. Create Repository

```bash
# Initialize git if not already done
cd /Users/partha/Desktop/Cook
git init

# Create .gitignore
cat > .gitignore << EOF
.DS_Store
*.log
node_modules/
.vscode/
EOF

# Initial commit
git add .
git commit -m "Initial commit: Parth's Cookbook v1.0"
```

### 2. Push to GitHub

```bash
# Create repository on GitHub named 'cookbook'
# Then add remote and push:

git remote add origin https://github.com/YOUR_USERNAME/cookbook.git
git branch -M main
git push -u origin main
```

### 3. Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** → **Pages** (in left sidebar)
3. Under "Source", select **main** branch
4. Leave folder as **/ (root)**
5. Click **Save**

Your site will be published at: `https://YOUR_USERNAME.github.io/cookbook/`

## Configuration Notes

### Base Path

Since you're deploying to `/cookbook/` path, all asset paths are relative and will work automatically:

- ✅ `css/tokens.css`
- ✅ `data/recipes.json`
- ✅ `js/app.js`

No base path configuration needed!

### Hash Routing

The app uses hash-based routing (`#/recipe/chicken-tikka`), which works perfectly with GitHub Pages:

- No server configuration needed
- All routes work directly
- Refresh works on any page

### Custom Domain (Optional)

If you want to use a custom domain:

1. Add a `CNAME` file to the root:
   ```
   cookbook.yourdomain.com
   ```

2. Configure DNS:
   - Add a CNAME record pointing to `YOUR_USERNAME.github.io`

3. Enable "Enforce HTTPS" in GitHub Pages settings

## Deployment Checklist

Before deploying:

- [ ] All paths are relative (no `/` prefix)
- [ ] `index.html` exists in root
- [ ] All data files in `data/` folder
- [ ] All CSS in `css/` folder
- [ ] All JS in `js/` folder
- [ ] Test locally with `python3 -m http.server 8000`
- [ ] Commit and push all files
- [ ] GitHub Pages enabled in settings
- [ ] Wait 1-2 minutes for build
- [ ] Visit `https://YOUR_USERNAME.github.io/cookbook/`

## Updating the Site

After making changes:

```bash
git add .
git commit -m "Update: [describe changes]"
git push origin main
```

GitHub Pages will rebuild automatically (takes 1-2 minutes).

## Testing Locally

Always test locally before deploying:

```bash
# From repository root
python3 -m http.server 8000

# Or with Node
npx serve

# Then visit
http://localhost:8000
```

Test:
- [ ] Menu board loads with recipes
- [ ] Filters work (tri-state chips)
- [ ] Recipe detail page opens
- [ ] Fridge matcher works
- [ ] Cook mode works
- [ ] Mode toggle (Studio/Reading)
- [ ] Search (Cmd/Ctrl + K)
- [ ] Mobile responsive

## Performance

GitHub Pages serves static files with:
- CDN distribution
- Gzip compression
- HTTPS by default
- Good caching headers

No optimization needed for this stack.

## Troubleshooting

### Site not loading?

1. Check repository name matches URL path
2. Verify GitHub Pages is enabled
3. Wait 2-3 minutes after enabling
4. Check for 404 errors in browser console

### Assets not loading?

1. Verify all paths are relative (no leading `/`)
2. Check file names match case-exactly (GitHub is case-sensitive)
3. Ensure files are committed and pushed

### Hash routes not working?

Hash routing (`#/`) should work automatically. If not:
- Clear browser cache
- Check console for JavaScript errors
- Verify `js/app.js` is loading

## Next Steps

After deployment:

1. Add more recipe content to `data/recipes.json`
2. Create SVG sketches in `assets/sketches/`
3. Complete stub views (Tonight, Planner, Host)
4. Add host menus to `data/host-menus.json`
5. Create illustration system (WP3)
6. Run QA checklist from plan

## Repository Settings Recommendations

- **Branch protection**: Enable for `main` branch
- **Squash merging**: Enable for cleaner history
- **Auto-merge**: Enable for approved PRs
- **Topics**: Add tags like `cookbook`, `recipes`, `static-site`, `github-pages`

---

Your cookbook is live at: `https://YOUR_USERNAME.github.io/cookbook/`

Share the link, cook something delicious! 🍳
