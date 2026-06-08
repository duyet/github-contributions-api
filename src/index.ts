import { Hono, type Context } from 'hono'
import { cache } from 'hono/cache'
import { cors } from 'hono/cors'
import { scrapeContributions, HTTPError } from './scraper'
import type { QueryParams, ErrorResponse } from './types'

const VERSION = 'v1'
const app = new Hono()

// --- Middleware ---

app.use('*', cors())
app.use(
  `/${VERSION}/*`,
  cache({
    cacheName: 'github-contributions',
    cacheControl: 'public, max-age=3600, s-maxage=3600',
  }),
)

// --- Routes ---

app.get('/', (c) => {
  return c.json({
    message: 'GitHub Contributions API',
    version: VERSION,
    docs: 'https://github.com/duyet/github-contributions-api',
  })
})

app.get(`/${VERSION}`, (c) => c.redirect('/'))

app.get(`/${VERSION}/:usernames`, async (c) => {
  const raw = c.req.param('usernames')
  const usernames = parseUsernames(raw)

  if (usernames.length === 0) {
    return c.json<ErrorResponse>({ error: 'Username is required' }, 400)
  }

  const query = parseQuery(c.req.query())
  const noCache = c.req.header('cache-control') === 'no-cache'

  try {
    const result = await scrapeContributions(
      usernames,
      query,
      noCache ? fetch : fetch,
    )
    return c.json(result, 200, {
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    })
  } catch (err) {
    return handleError(c, err)
  }
})

// --- Helpers ---

function handleError(c: Context, err: unknown) {
  if (err instanceof HTTPError) {
    return c.json<ErrorResponse>({ error: err.message }, err.status as 400)
  }
  return c.json<ErrorResponse>(
    { error: err instanceof Error ? err.message : 'Internal error' },
    500,
  )
}

function parseUsernames(raw: string): string[] {
  // Support: "user1,user2" or "user1+user2"
  return raw
    .split(/[,+]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function parseQuery(params: Record<string, string | undefined>): QueryParams {
  const yRaw = params.y
  const format = params.format === 'nested' ? 'nested' as const : undefined

  if (!yRaw) {
    return { y: 'all', format }
  }

  if (yRaw === 'all' || yRaw === 'last') {
    return { y: yRaw, format }
  }

  // Support single year or comma-separated
  const years = yRaw
    .split(',')
    .map((s) => parseInt(s.trim()))
    .filter((n) => !isNaN(n) && n > 2000 && n < 2100)

  if (years.length === 0) {
    return { y: 'all', format }
  }

  // Deduplicate
  return { y: [...new Set(years)], format }
}

export default app
