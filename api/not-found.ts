/**
 * The real 404 for paths that are not part of this site.
 *
 * A single-page app on a static host answers every unknown path with the app
 * shell and a 200, which is a soft 404: a crawler concludes every path exists,
 * and an agent probing for a resource is told yes forever. vercel.json rewrites
 * anything that is not a known route here, and this returns an actual 404.
 *
 * The body is markdown when the caller asks for it and HTML otherwise, but both
 * say the same thing and both point at the machine-readable index — a 404 that
 * ends the conversation is a wasted response when we could hand over a map.
 */
const SITE = 'https://concordiatracker.com'

const MARKDOWN = `# 404 — Not found

That path is not part of ConcordiaTracker.

ConcordiaTracker is a deadline, grade, and GPA tracker for Concordia University
students. It is independent and not affiliated with Concordia University.

## Where to look instead

- [Home](${SITE}/)
- [Documentation](${SITE}/docs/introduction)
- [Developer resources and API](${SITE}/developers)
- [OpenAPI specification](${SITE}/openapi.json)
- [llms.txt](${SITE}/llms.txt) — the machine-readable index of this site
- [Sitemap](${SITE}/sitemap.xml)
- [Contact](${SITE}/contact)
`

const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, follow" />
<title>404 — Not found · ConcordiaTracker</title>
<style>
:root{color-scheme:dark;--bg:#0f0f16;--surface:#191926;--fg:#f2f1f6;--muted:#b9b7c4;--accent:#8fb39a;--border:#2a2a3a}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;
display:flex;align-items:center;justify-content:center;min-height:100vh;padding:32px}
main{max-width:38rem;width:100%}
h1{font-size:30px;line-height:1.15;margin:0 0 12px;font-weight:600}
p{color:var(--muted);margin:0 0 16px}
ul{list-style:none;padding:0;margin:24px 0 0;border-top:1px solid var(--border)}
li{border-bottom:1px solid var(--border)}
a{color:var(--accent);text-decoration:none}
li a{display:block;padding:11px 2px}
li a:hover{text-decoration:underline}
small{color:#8b8898;display:block;margin-top:24px}
</style>
</head>
<body>
<main>
  <h1>404 — Not found</h1>
  <p>That path is not part of ConcordiaTracker. ConcordiaTracker is a deadline, grade, and GPA
  tracker for Concordia University students. It is independent and not affiliated with Concordia
  University.</p>
  <ul>
    <li><a href="/">Home</a></li>
    <li><a href="/docs/introduction">Documentation</a></li>
    <li><a href="/developers">Developer resources and API</a></li>
    <li><a href="/openapi.json">OpenAPI specification</a></li>
    <li><a href="/llms.txt">llms.txt — the machine-readable index of this site</a></li>
    <li><a href="/sitemap.xml">Sitemap</a></li>
    <li><a href="/contact">Contact</a></li>
  </ul>
  <small>HTTP 404</small>
</main>
</body>
</html>
`

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function handler(req: any, res: any) {
  const accept = String(req.headers?.accept ?? '')
  // vercel.json routes unknown /api/* paths here with ?json=1, because the
  // site-wide catch-all was answering them with an HTML page — unparseable to
  // the one caller guaranteed to be a program rather than a person.
  const forcedJson = /[?&]json=1(&|$)/.test(String(req.url ?? ''))
  const wantsMarkdown = !forcedJson && /text\/markdown/i.test(accept)
  const wantsJson =
    forcedJson ||
    (!wantsMarkdown && /application\/json/i.test(accept) && !/text\/html/i.test(accept))

  // Cached variants must not be crossed over between callers asking for
  // different representations of the same URL.
  res.setHeader('Vary', 'Accept, Accept-Encoding')
  res.setHeader('X-Robots-Tag', 'noindex')

  if (wantsJson) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.status(404).send(
      JSON.stringify(
        {
          error: 'Not found',
          code: 'not_found',
          message: 'That path is not part of ConcordiaTracker.',
          hint: `Start from ${SITE}/llms.txt, ${SITE}/sitemap.xml, or ${SITE}/openapi.json.`,
          status: 404,
          docs: `${SITE}/docs/introduction`,
        },
        null,
        2,
      ),
    )
    return
  }

  if (wantsMarkdown) {
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
    res.status(404).send(MARKDOWN)
    return
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.status(404).send(HTML)
}
