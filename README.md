# Recipe Box

A static, offline-capable recipe PWA. React + Vite, with recipes stored in a JSON file.

## Run locally

```bash
npm install
npm run dev
```

## Deploy (GitHub + Netlify)

1. Push this folder to a GitHub repo.
2. In Netlify, choose "Import from Git" and pick the repo. The build settings are already in `netlify.toml` (`npm run build`, publish `dist`).
3. Open the site on your phone and use "Add to Home Screen" to install it.

## Add a recipe

Open `src/recipes.json` and add an object to the array. Fields:

| Field | Notes |
| --- | --- |
| `id` | Unique, lowercase, hyphenated. Used in the URL. |
| `title`, `summary`, `category`, `protein`, `time` | Shown on cards and searchable. |
| `servings` | Base serving count. The app scales ingredient quantities from this. |
| `servingsLabel` | Optional, e.g. `"flatbreads"`. |
| `tags` | Searchable and shown as filter chips. |
| `ingredients` | List of `{ "q": number or null, "u": "unit", "i": "ingredient text" }`. Use `null` for "to taste". |
| `steps` | List of strings. |
| `notes` | Optional tips. |

## What is saved on the device

Favorites, ingredient and step check-offs, and personal notes are saved in the browser's local storage. They stay on that device and are not synced.

## Search

The search box matches words across the title, summary, category, protein, tags, and ingredients. Tag chips combine, so "kid-approved" plus "light" shows only recipes with both.
