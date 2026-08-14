/**
 * Docs renderer — turns the content model in `content.mjs` into standalone HTML.
 *
 * WHY STATIC HTML AND NOT A REACT ROUTE: the whole point of these pages is that
 * search engines and AI answer engines can read them. Googlebot renders JS, but
 * GPTBot / PerplexityBot / ClaudeBot largely do not — they fetch raw HTML and
 * move on. A client-rendered route serves them an empty <div id="root">, which
 * is exactly what the rest of this site currently does. So docs are generated
 * files with their content already in the markup.
 *
 * The theme is LOCKED to the default dark palette, same call as the legal pages:
 * these are read by people who aren't signed in, so there's no theme preference
 * to honour, and inlining one palette keeps each page a single self-contained
 * file with no stylesheet build coupling.
 */

const SITE = 'https://concordiatracker.com'

/* ── escaping + inline formatting ─────────────────────────────────────────── */

export function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** `**bold**`, `` `code` ``, `[text](href)` — deliberately tiny. */
function inline(s) {
  let out = esc(s)
  out = out.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
  out = out.replace(/\*\*([^*]+)\*\*/g, (_, c) => `<strong>${c}</strong>`)
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, href) => {
    const external = /^https?:/.test(href)
    const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : ''
    return `<a href="${esc(href)}"${attrs}>${text}</a>`
  })
  return out
}

export function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

/* ── icons (inline SVG — no icon font, no runtime dependency) ─────────────── */

const ICONS = {
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  calendar:
    '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  calculator:
    '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M8 6h8M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01M8 18h4"/>',
  users:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/>',
  card: '<rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/>',
  check: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V6l8-3 8 3z"/><path d="m9 12 2 2 4-4"/>',
  layout:
    '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18M9 21V9"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
}

function icon(name) {
  const path = ICONS[name] || ICONS.book
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`
}

/* ── block rendering ──────────────────────────────────────────────────────── */

function block(b) {
  if (b.h2) return `<h2 id="${slug(b.h2)}">${inline(b.h2)}</h2>`
  if (b.h3) return `<h3 id="${slug(b.h3)}">${inline(b.h3)}</h3>`
  if (b.p) return `<p>${inline(b.p)}</p>`
  if (b.ul) return `<ul>${b.ul.map((li) => `<li>${inline(li)}</li>`).join('')}</ul>`
  if (b.ol) return `<ol>${b.ol.map((li) => `<li>${inline(li)}</li>`).join('')}</ol>`
  if (b.note)
    return `<div class="note"><span class="note-mark" aria-hidden="true"></span><p>${inline(b.note)}</p></div>`
  if (b.cards)
    return `<div class="cards">${b.cards
      .map(
        (c) => `<a class="card" href="${esc(c.href)}">
          <span class="card-icon">${icon(c.icon)}</span>
          <span class="card-title">${inline(c.title)}</span>
          <span class="card-desc">${inline(c.desc)}</span>
        </a>`,
      )
      .join('')}</div>`
  if (b.table) {
    const head = b.table.head.map((h) => `<th>${inline(h)}</th>`).join('')
    const rows = b.table.rows
      .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
      .join('')
    return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`
  }
  return ''
}

/** Plain text of a page — for the search index and the meta description fallback. */
export function plainText(page) {
  const parts = []
  for (const b of page.blocks) {
    if (b.p) parts.push(b.p)
    if (b.h2) parts.push(b.h2)
    if (b.h3) parts.push(b.h3)
    if (b.ul) parts.push(b.ul.join(' '))
    if (b.ol) parts.push(b.ol.join(' '))
    if (b.note) parts.push(b.note)
    if (b.cards) parts.push(b.cards.map((c) => `${c.title} ${c.desc}`).join(' '))
  }
  return parts
    .join(' ')
    .replace(/[*`]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

/* ── page shell ───────────────────────────────────────────────────────────── */

function sidebar(nav, currentSlug) {
  return nav
    .map(
      (group) => `<div class="nav-group">
        <p class="nav-group-title">${esc(group.title)}</p>
        <ul>${group.pages
          .map((p) => {
            const active = p.slug === currentSlug
            return `<li><a href="/docs/${p.slug}"${active ? ' class="active" aria-current="page"' : ''}>${esc(p.title)}</a></li>`
          })
          .join('')}</ul>
      </div>`,
    )
    .join('')
}

function onThisPage(page) {
  const heads = page.blocks.filter((b) => b.h2).map((b) => b.h2)
  if (!heads.length) return ''
  return `<aside class="toc" aria-label="On this page">
    <p class="toc-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M3 6h18M3 12h12M3 18h15"/></svg>On this page</p>
    <ul>${heads.map((h) => `<li><a href="#${slug(h)}">${esc(h)}</a></li>`).join('')}</ul>
  </aside>`
}

function pager(prev, next) {
  if (!prev && !next) return ''
  const card = (p, dir) =>
    p
      ? `<a class="pager-card ${dir}" href="/docs/${p.slug}">
           <span class="pager-dir">${dir === 'prev' ? '&larr; Previous' : 'Next &rarr;'}</span>
           <span class="pager-title">${esc(p.title)}</span>
         </a>`
      : '<span></span>'
  return `<nav class="pager">${card(prev, 'prev')}${card(next, 'next')}</nav>`
}

export function renderPage({ page, nav, prev, next, searchIndex, year }) {
  const desc = page.description || plainText(page).slice(0, 155)
  const url = `${SITE}/docs/${page.slug}`
  const title = `${page.title} — ConcordiaTracker Docs`

  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<link rel="canonical" href="${esc(url)}" />
<meta name="robots" content="index, follow" />
<meta name="color-scheme" content="dark" />
<meta name="theme-color" content="#0f0f16" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="ConcordiaTracker Docs" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:url" content="${esc(url)}" />
<meta property="og:image" content="${SITE}/og-image.png" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: page.title,
    description: desc,
    url,
    isPartOf: { '@type': 'WebSite', name: 'ConcordiaTracker', url: SITE },
    publisher: { '@type': 'Organization', name: 'ConcordiaTracker', url: SITE },
  })}</script>
<style>${CSS}</style>
</head>
<body>
<header class="topbar">
  <a class="brand" href="/">
    <span class="brand-mark" aria-hidden="true"></span>
    <span class="brand-name">Concordia<span class="brand-dim">Tracker</span></span>
    <span class="brand-pill">DOCS</span>
  </a>
  <div class="search">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
    <input id="q" type="search" placeholder="Search…" autocomplete="off" aria-label="Search the docs" />
    <kbd>Ctrl K</kbd>
    <ul id="results" role="listbox" hidden></ul>
  </div>
  <a class="portal" href="/app">Open app &rarr;</a>
</header>

<div class="shell">
  <nav class="sidebar" aria-label="Documentation">${sidebar(nav, page.slug)}</nav>

  <main>
    <p class="crumb">${esc(page.section)}</p>
    <h1>${esc(page.title)}</h1>
    ${page.blocks.map(block).join('\n    ')}
    ${pager(prev, next)}
    <footer class="foot">
      <span>&copy; ${year} ConcordiaTracker</span>
      <span>Not affiliated with Concordia University.</span>
    </footer>
  </main>

  ${onThisPage(page)}
</div>

<script>
// Search is progressive enhancement — every word above is already in the HTML,
// so this only ever makes an already-complete page faster to navigate.
const IDX = ${JSON.stringify(searchIndex)};
const q = document.getElementById('q');
const results = document.getElementById('results');
function render(list) {
  if (!list.length) { results.hidden = true; results.innerHTML = ''; return; }
  results.innerHTML = list.slice(0, 8).map(function (p) {
    return '<li><a href="/docs/' + p.slug + '"><strong>' + p.title + '</strong><span>' + p.section + '</span></a></li>';
  }).join('');
  results.hidden = false;
}
q.addEventListener('input', function () {
  const v = q.value.trim().toLowerCase();
  if (!v) return render([]);
  const terms = v.split(/\\s+/);
  render(IDX.filter(function (p) {
    const hay = (p.title + ' ' + p.section + ' ' + p.text).toLowerCase();
    return terms.every(function (t) { return hay.includes(t); });
  }));
});
q.addEventListener('blur', function () { setTimeout(function () { results.hidden = true; }, 150); });
document.addEventListener('keydown', function (e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); q.focus(); q.select(); }
  if (e.key === 'Escape') { q.blur(); results.hidden = true; }
});
</script>
</body>
</html>`
}

/* ── styles ───────────────────────────────────────────────────────────────── */
/* Token values mirror the dark theme in src/index.css. Inlined rather than
 * imported so each page is one self-contained file. If the palette is re-skinned
 * there, update these five lines to match. */
const CSS = `
:root{
  --canvas:#0f0f16; --surface:#191926; --surface-2:#222231;
  --border:#2c2c3d; --border-strong:#3b3b50;
  --fg:#f4f3f7; --muted:#b2b0c2; --subtle:#8b8898;
  --accent:#8fb39a; --accent-soft:rgba(143,179,154,.14);
  --display:'Hanken Grotesk','Inter',system-ui,sans-serif;
  --body:'Inter',system-ui,sans-serif;
}
*{box-sizing:border-box}
html{background:var(--canvas);scrollbar-width:thin;scrollbar-color:var(--border-strong) transparent}
body{margin:0;background:var(--canvas);color:var(--fg);font-family:var(--body);font-size:15px;line-height:1.65;-webkit-font-smoothing:antialiased}
::-webkit-scrollbar{width:10px;height:10px}
::-webkit-scrollbar-thumb{background:var(--border-strong);border:3px solid transparent;background-clip:padding-box;border-radius:99px}
::-webkit-scrollbar-thumb:hover{background:var(--subtle);border:3px solid transparent;background-clip:padding-box}
a{color:inherit}

.topbar{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:16px;padding:10px 20px;background:color-mix(in srgb,var(--canvas) 88%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--border)}
.brand{display:flex;align-items:center;gap:8px;text-decoration:none;flex-shrink:0}
.brand-mark{width:20px;height:20px;border-radius:6px;background:var(--surface-2);position:relative}
.brand-mark::after{content:"";position:absolute;inset:6px;border-radius:99px;background:var(--accent)}
.brand-name{font-family:var(--display);font-weight:600;font-size:15px;letter-spacing:-.01em}
.brand-dim{color:var(--muted)}
.brand-pill{font-size:9.5px;font-weight:700;letter-spacing:.1em;color:var(--accent);background:var(--accent-soft);border-radius:4px;padding:2px 5px}
.portal{margin-left:auto;flex-shrink:0;font-size:13px;font-weight:500;color:var(--muted);text-decoration:none;border:1px solid var(--border);border-radius:8px;padding:6px 12px;transition:color .15s,border-color .15s}
.portal:hover{color:var(--fg);border-color:var(--border-strong)}

.search{position:relative;flex:1;max-width:420px;margin:0 auto;display:flex;align-items:center;gap:8px;background:var(--surface);border:1px solid var(--border);border-radius:9px;padding:0 10px}
.search svg{width:15px;height:15px;color:var(--subtle);flex-shrink:0}
.search input{flex:1;min-width:0;background:none;border:0;outline:0;color:var(--fg);font:inherit;font-size:13px;padding:7px 0}
.search input::placeholder{color:var(--subtle)}
.search kbd{font:inherit;font-size:10px;color:var(--subtle);border:1px solid var(--border);border-radius:4px;padding:1px 5px;flex-shrink:0}
#results{position:absolute;top:calc(100% + 6px);left:0;right:0;margin:0;padding:4px;list-style:none;background:var(--surface);border:1px solid var(--border);border-radius:11px;box-shadow:0 20px 50px -20px rgba(0,0,0,.8);max-height:60vh;overflow:auto}
#results a{display:flex;flex-direction:column;gap:1px;padding:7px 10px;border-radius:7px;text-decoration:none;font-size:13px}
#results a:hover{background:var(--surface-2)}
#results span{font-size:11.5px;color:var(--subtle)}

.shell{display:grid;grid-template-columns:236px minmax(0,1fr) 200px;gap:40px;max-width:1240px;margin:0 auto;padding:34px 24px 80px}
.sidebar{position:sticky;top:80px;align-self:start;max-height:calc(100vh - 100px);overflow-y:auto;font-size:13px}
.nav-group + .nav-group{margin-top:22px}
.nav-group-title{margin:0 0 7px;font-family:var(--display);font-size:12px;font-weight:600;color:var(--fg)}
.sidebar ul{list-style:none;margin:0;padding:0}
.sidebar a{display:block;padding:5px 10px;border-radius:7px;color:var(--muted);text-decoration:none;transition:color .15s,background .15s}
.sidebar a:hover{color:var(--fg);background:var(--surface)}
.sidebar a.active{color:var(--fg);background:var(--surface-2);font-weight:500}

main{min-width:0}
.crumb{margin:0 0 6px;font-size:12.5px;color:var(--subtle)}
h1{font-family:var(--display);font-size:35px;line-height:1.15;font-weight:600;letter-spacing:-.02em;margin:0 0 22px}
h2{font-family:var(--display);font-size:20px;font-weight:600;letter-spacing:-.01em;margin:38px 0 12px;scroll-margin-top:80px}
h3{font-family:var(--display);font-size:16px;font-weight:600;margin:26px 0 8px;scroll-margin-top:80px}
p{margin:0 0 14px;color:var(--muted);max-width:64ch}
main a{color:var(--accent);text-decoration:none}
main a:hover{text-decoration:underline}
strong{color:var(--fg);font-weight:600}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.88em;background:var(--surface-2);border:1px solid var(--border);border-radius:5px;padding:1px 5px;color:var(--fg)}
main ul,main ol{margin:0 0 14px;padding-left:0;max-width:64ch;color:var(--muted)}
main ul{list-style:none}
main ul li{position:relative;padding-left:18px;margin-bottom:6px}
main ul li::before{content:"";position:absolute;left:2px;top:.62em;width:5px;height:5px;border-radius:99px;background:var(--accent)}
main ol{padding-left:20px}
main ol li{margin-bottom:6px;padding-left:4px}
ol li::marker{color:var(--accent);font-weight:600}

.note{display:flex;gap:11px;background:var(--accent-soft);border:1px solid color-mix(in srgb,var(--accent) 30%,transparent);border-radius:11px;padding:13px 15px;margin:0 0 16px;max-width:64ch}
.note-mark{flex-shrink:0;width:4px;border-radius:99px;background:var(--accent)}
.note p{margin:0;color:var(--fg);font-size:14px}

.cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:18px 0 22px}
.card{display:flex;flex-direction:column;gap:5px;background:var(--surface);border:1px solid var(--border);border-radius:13px;padding:16px;text-decoration:none;transition:border-color .15s,background .15s}
.card:hover{border-color:var(--border-strong);background:var(--surface-2)}
.card-icon{color:var(--accent);margin-bottom:5px}
.card-icon svg{width:19px;height:19px}
.card-title{font-family:var(--display);font-size:14.5px;font-weight:600;color:var(--fg)}
.card-desc{font-size:13px;color:var(--muted);line-height:1.55}
.card:hover .card-title{text-decoration:none}

.table-wrap{overflow-x:auto;margin:0 0 18px}
table{border-collapse:collapse;width:100%;font-size:13.5px;min-width:420px}
th,td{text-align:left;padding:9px 13px;border-bottom:1px solid var(--border)}
th{font-family:var(--display);font-weight:600;color:var(--fg);font-size:12.5px;border-bottom-color:var(--border-strong)}
td{color:var(--muted)}

.pager{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:52px}
.pager-card{display:flex;flex-direction:column;gap:2px;border:1px solid var(--border);border-radius:11px;padding:13px 16px;text-decoration:none;transition:border-color .15s}
.pager-card:hover{border-color:var(--border-strong)}
.pager-card.next{text-align:right}
.pager-dir{font-size:11.5px;color:var(--subtle)}
.pager-title{font-family:var(--display);font-size:14px;font-weight:600;color:var(--fg)}

.foot{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-top:44px;padding-top:18px;border-top:1px solid var(--border);font-size:12px;color:var(--subtle)}

.toc{position:sticky;top:80px;align-self:start;font-size:12.5px}
.toc-title{display:flex;align-items:center;gap:7px;margin:0 0 9px;font-weight:600;color:var(--fg);font-size:12px}
.toc-title svg{width:14px;height:14px;color:var(--subtle)}
.toc ul{list-style:none;margin:0;padding:0}
.toc li{margin-bottom:5px;padding:0}
.toc li::before{display:none}
.toc a{color:var(--subtle);text-decoration:none}
.toc a:hover{color:var(--fg)}

@media (max-width:1100px){
  .shell{grid-template-columns:212px minmax(0,1fr);gap:32px}
  .toc{display:none}
}
@media (max-width:760px){
  .topbar{flex-wrap:wrap;gap:10px}
  .search{order:3;flex-basis:100%;max-width:none;margin:0}
  .portal{margin-left:0}
  .shell{grid-template-columns:minmax(0,1fr);padding:22px 18px 60px}
  .sidebar{position:static;max-height:none;border-bottom:1px solid var(--border);padding-bottom:18px}
  .cards{grid-template-columns:minmax(0,1fr)}
  .pager{grid-template-columns:minmax(0,1fr)}
  h1{font-size:29px}
}
`
