import React, { useEffect, useMemo, useRef, useState } from 'react'
import recipes from './recipes.json'

// ---------- tiny localStorage helpers (safe if storage is blocked) ----------
function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}
function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}
function usePersisted(key, initial) {
  const [value, setValue] = useState(() => load(key, initial))
  useEffect(() => save(key, value), [key, value])
  return [value, setValue]
}

// ---------- quantity formatting ----------
const FRACTIONS = [
  [0, ''],
  [0.25, '¼'],
  [1 / 3, '⅓'],
  [0.5, '½'],
  [2 / 3, '⅔'],
  [0.75, '¾'],
  [1, '']
]
function formatQty(n) {
  if (n == null) return ''
  const whole = Math.floor(n)
  const frac = n - whole
  let best = FRACTIONS[0]
  for (const f of FRACTIONS) {
    if (Math.abs(f[0] - frac) < Math.abs(best[0] - frac)) best = f
  }
  let w = whole
  if (best[0] === 1) w += 1
  const symbol = best[1]
  if (w === 0 && symbol) return symbol
  if (w === 0) return '⅛'
  return symbol ? `${w}${symbol}` : `${w}`
}

// ---------- routing via hash ----------
function useHashRoute() {
  const get = () => window.location.hash.replace(/^#\/?/, '')
  const [route, setRoute] = useState(get())
  useEffect(() => {
    const onChange = () => setRoute(get())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

// ---------- screen wake lock ----------
function useWakeLock(enabled) {
  const lockRef = useRef(null)
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return
    let cancelled = false
    const request = async () => {
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (cancelled) lock.release()
        else lockRef.current = lock
      } catch {
        /* denied or unsupported */
      }
    }
    request()
    const onVisible = () => {
      if (document.visibilityState === 'visible') request()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      lockRef.current?.release()
      lockRef.current = null
    }
  }, [enabled])
}

// ---------- meal types and recipe links ----------
const CATEGORY_ORDER = ['Main', 'Side', 'Salad', 'Bread']
const CATEGORY_LABELS = { Main: 'Mains', Side: 'Sides', Salad: 'Salads', Bread: 'Breads' }
const byId = Object.fromEntries(recipes.map((r) => [r.id, r]))

// Pairings are defined on each recipe, and also flow both ways so a link
// added on one recipe shows up on the other.
function getPairs(recipe) {
  const out = [...(recipe.pairs || [])]
  const seen = new Set(out.map((p) => p.id))
  for (const other of recipes) {
    if (other.id === recipe.id || seen.has(other.id)) continue
    if ((other.pairs || []).some((p) => p.id === recipe.id)) {
      out.push({ id: other.id, why: `Pairs with ${other.title}.` })
      seen.add(other.id)
    }
  }
  return out.filter((p) => byId[p.id])
}

// ---------- list view ----------
function matches(recipe, query) {
  if (!query) return true
  const haystack = [
    recipe.title,
    recipe.summary,
    recipe.category,
    recipe.protein,
    ...recipe.tags,
    ...recipe.ingredients.map((i) => i.i)
  ]
    .join(' ')
    .toLowerCase()
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word))
}

function ListView({ favorites, toggleFavorite }) {
  const [query, setQuery] = useState('')
  const [activeTags, setActiveTags] = useState([])
  const [favsOnly, setFavsOnly] = useState(false)
  const [category, setCategory] = useState('All')

  const allTags = useMemo(() => {
    const counts = {}
    recipes.forEach((r) => r.tags.forEach((t) => (counts[t] = (counts[t] || 0) + 1)))
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([t]) => t)
  }, [])

  const results = recipes.filter(
    (r) =>
      matches(r, query) &&
      activeTags.every((t) => r.tags.includes(t)) &&
      (category === 'All' || r.category === category) &&
      (!favsOnly || favorites.includes(r.id))
  )

  const groups = CATEGORY_ORDER.map((c) => ({
    category: c,
    items: results.filter((r) => r.category === c)
  })).filter((g) => g.items.length > 0)

  const toggleTag = (t) =>
    setActiveTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))

  return (
    <>
      <header className="top">
        <h1>Recipe Box</h1>
        <input
          type="search"
          className="search"
          placeholder="Search recipes or ingredients"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search recipes"
        />
        <div className="tabs" role="tablist" aria-label="Meal type">
          {['All', ...CATEGORY_ORDER].map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={category === c}
              className={`tab ${category === c ? 'on' : ''}`}
              onClick={() => setCategory(c)}
            >
              {c === 'All' ? 'All' : CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
        <div className="chips" role="group" aria-label="Filter by tag">
          <button
            className={`chip ${favsOnly ? 'on' : ''}`}
            onClick={() => setFavsOnly((v) => !v)}
            aria-pressed={favsOnly}
          >
            ★ Favorites
          </button>
          {allTags.map((t) => (
            <button
              key={t}
              className={`chip ${activeTags.includes(t) ? 'on' : ''}`}
              onClick={() => toggleTag(t)}
              aria-pressed={activeTags.includes(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      <main className="list">
        {results.length === 0 && <p className="empty">No recipes match. Try fewer filters.</p>}
        {groups.map((g) => (
          <section key={g.category} className="group">
            <h2 className="group-title">
              {CATEGORY_LABELS[g.category]} <span>{g.items.length}</span>
            </h2>
            <div className="group-items">
              {g.items.map((r) => (
                <a key={r.id} className="card" href={`#/${r.id}`}>
                  <div className="card-head">
                    <h3>{r.title}</h3>
                    <button
                      className={`star ${favorites.includes(r.id) ? 'on' : ''}`}
                      onClick={(e) => {
                        e.preventDefault()
                        toggleFavorite(r.id)
                      }}
                      aria-label={favorites.includes(r.id) ? 'Remove favorite' : 'Add favorite'}
                    >
                      {favorites.includes(r.id) ? '★' : '☆'}
                    </button>
                  </div>
                  <p className="meta">
                    {r.time} · serves {r.servings}
                    {r.servingsLabel ? ` ${r.servingsLabel}` : ''}
                  </p>
                  <p className="summary">{r.summary}</p>
                </a>
              ))}
            </div>
          </section>
        ))}
      </main>
    </>
  )
}

// ---------- detail view ----------
function DetailView({ recipe, favorites, toggleFavorite }) {
  const [servings, setServings] = useState(recipe.servings)
  const [awake, setAwake] = useState(false)
  const [checked, setChecked] = usePersisted(`checked:${recipe.id}`, [])
  const [done, setDone] = usePersisted(`done:${recipe.id}`, [])
  const [notes, setNotes] = usePersisted(`notes:${recipe.id}`, '')
  const factor = servings / recipe.servings
  const canWake = typeof navigator !== 'undefined' && 'wakeLock' in navigator
  const pairs = getPairs(recipe)

  useWakeLock(awake)

  const toggle = (list, setList, idx) =>
    setList((cur) => (cur.includes(idx) ? cur.filter((x) => x !== idx) : [...cur, idx]))

  const reset = () => {
    setChecked([])
    setDone([])
  }

  useEffect(() => window.scrollTo(0, 0), [recipe.id])

  return (
    <main className="detail">
      <div className="bar">
        <a href="#/" className="back">
          ← All recipes
        </a>
        <button
          className={`star big ${favorites.includes(recipe.id) ? 'on' : ''}`}
          onClick={() => toggleFavorite(recipe.id)}
          aria-label="Toggle favorite"
        >
          {favorites.includes(recipe.id) ? '★' : '☆'}
        </button>
      </div>

      <h1>{recipe.title}</h1>
      <p className="meta">
        {recipe.category} · {recipe.time}
      </p>
      <p className="summary">{recipe.summary}</p>
      <div className="tag-row">
        {recipe.tags.map((t) => (
          <span key={t} className="tag">
            {t}
          </span>
        ))}
      </div>

      <div className="controls">
        <div className="stepper" aria-label="Servings">
          <button onClick={() => setServings((s) => Math.max(1, s - 1))} aria-label="Fewer servings">
            −
          </button>
          <span>
            {servings} {recipe.servingsLabel || 'servings'}
          </span>
          <button onClick={() => setServings((s) => s + 1)} aria-label="More servings">
            +
          </button>
        </div>
        {canWake && (
          <label className="switch">
            <input type="checkbox" checked={awake} onChange={(e) => setAwake(e.target.checked)} />
            Keep screen awake
          </label>
        )}
      </div>

      <section>
        <div className="section-head">
          <h2>Ingredients</h2>
          <button className="link" onClick={reset}>
            Reset checks
          </button>
        </div>
        <ul className="ingredients">
          {recipe.ingredients.map((ing, idx) => (
            <li key={idx}>
              <label className={checked.includes(idx) ? 'struck' : ''}>
                <input
                  type="checkbox"
                  checked={checked.includes(idx)}
                  onChange={() => toggle(checked, setChecked, idx)}
                />
                <span>
                  {ing.q != null && (
                    <strong>
                      {formatQty(ing.q * factor)} {ing.u}{' '}
                    </strong>
                  )}
                  {ing.link && byId[ing.link] ? (
                    <a
                      className="inline-link"
                      href={`#/${ing.link}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {ing.i}
                    </a>
                  ) : (
                    ing.i
                  )}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Steps</h2>
        <ol className="steps">
          {recipe.steps.map((s, idx) => (
            <li
              key={idx}
              className={done.includes(idx) ? 'struck' : ''}
              onClick={() => toggle(done, setDone, idx)}
            >
              {s}
            </li>
          ))}
        </ol>
        <p className="hint">Tap a step to cross it off.</p>
      </section>

      {recipe.notes && (
        <section>
          <h2>Tips</h2>
          <p>{recipe.notes}</p>
        </section>
      )}

      {pairs.length > 0 && (
        <section>
          <h2>Serve with</h2>
          <ul className="pairs">
            {pairs.map((p) => (
              <li key={p.id}>
                <a href={`#/${p.id}`} className="pair">
                  <span className="pair-title">
                    {byId[p.id].title}
                    <em>{CATEGORY_LABELS[byId[p.id].category]}</em>
                  </span>
                  <span className="pair-why">{p.why}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2>My notes</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What worked, what to change next time…"
          rows={4}
        />
      </section>
    </main>
  )
}

// ---------- app ----------
export default function App() {
  const route = useHashRoute()
  const [favorites, setFavorites] = usePersisted('favorites', [])
  const toggleFavorite = (id) =>
    setFavorites((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))

  const recipe = recipes.find((r) => r.id === route)

  return recipe ? (
    <DetailView recipe={recipe} favorites={favorites} toggleFavorite={toggleFavorite} />
  ) : (
    <ListView favorites={favorites} toggleFavorite={toggleFavorite} />
  )
}
