import type { Contribution, FlatResponse, NestedResponse, NestedContributions, QueryParams, Level } from './types'

export class HTTPError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// --- Public API ---

export async function scrapeContributions(
  usernames: string[],
  query: QueryParams,
  fetchFn: typeof fetch = fetch,
): Promise<FlatResponse | NestedResponse> {
  const results = await Promise.all(
    usernames.map((u) => scrapeSingleUser(u, query, fetchFn)),
  )

  const merged = results.length === 1 ? results[0] : mergeResponses(results)

  if (query.format === 'nested') {
    return toNested(merged)
  }
  return merged
}

// --- Single user scraping ---

async function scrapeSingleUser(
  username: string,
  query: QueryParams,
  fetchFn: typeof fetch,
): Promise<FlatResponse> {
  if (query.y === 'last') {
    return scrapeYear(username, 'lastYear', fetchFn)
  }

  const years = await scrapeYearLinks(username, query.y, fetchFn)
  const perYear = await Promise.all(
    years.map((y) => scrapeYear(username, y, fetchFn)),
  )

  return perYear.reduce(
    (acc, curr) => ({
      total: { ...acc.total, ...curr.total },
      contributions: [...acc.contributions, ...curr.contributions],
    }),
    { total: {} as Record<string, number>, contributions: [] as Contribution[] },
  )
}

async function scrapeYear(
  username: string,
  year: number | 'lastYear',
  fetchFn: typeof fetch,
): Promise<FlatResponse> {
  const url =
    year === 'lastYear'
      ? `https://github.com/users/${username}/contributions`
      : `https://github.com/users/${username}/contributions?tab=overview&from=${year}-12-01&to=${year}-12-31`

  const res = await fetchFn(url, {
    headers: {
      accept: 'text/html',
      referer: `https://github.com/${username}`,
      'x-requested-with': 'XMLHttpRequest',
    },
  })

  if (!res.ok) {
    if (res.status === 404) {
      throw new HTTPError(404, `GitHub user "${username}" not found.`)
    }
    throw new HTTPError(res.status, `GitHub returned ${res.status}`)
  }

  const html = await res.text()
  return parseHTML(html, year === 'lastYear' ? 'lastYear' : year)
}

// --- Year link discovery ---

async function scrapeYearLinks(
  username: string,
  years: 'all' | number[],
  fetchFn: typeof fetch,
): Promise<number[]> {
  // Try fetching year links from the contributions tab
  const res = await fetchFn(`https://github.com/${username}?tab=contributions`, {
    headers: { accept: 'text/html' },
  })

  if (!res.ok) {
    if (res.status === 404) {
      throw new HTTPError(404, `GitHub user "${username}" not found.`)
    }
    throw new HTTPError(res.status, `GitHub returned ${res.status}`)
  }

  const html = await res.text()
  const available: number[] = []
  const re = /class="js-year-link"[^>]*>(\d{4})<\/a>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    available.push(parseInt(m[1]))
  }

  // If year links not found (GitHub lazy-loads them), use requested years directly
  if (available.length === 0 && Array.isArray(years)) {
    return years
  }

  // For 'all' with no discovered years, try common range
  if (available.length === 0 && years === 'all') {
    const currentYear = new Date().getFullYear()
    const fallback: number[] = []
    for (let y = currentYear; y >= currentYear - 10; y--) {
      fallback.push(y)
    }
    return fallback
  }

  if (years === 'all') return available.sort()
  return available.filter((y) => years.includes(y)).sort()
}

// --- HTML parsing via HTMLRewriter ---

function parseHTML(html: string, year: number | 'lastYear'): FlatResponse {
  const contributions: Contribution[] = []
  let total = 0

  // Parse total from h2 heading.
  // GitHub renders this as multi-line: "729\n      contributions\n        in the last year"
  const h2Block = html.match(
    /js-contribution-activity-description[\s\S]*?<\/h2>/,
  )?.[0] || ''
  // Flatten whitespace and match "N contributions in ..."
  const flat = h2Block.replace(/\s+/g, ' ')
  const h2Match = /([\d,]+)\s+contributions?\s+in/i.exec(flat)
  if (h2Match) {
    total = parseInt(h2Match[1].replace(/,/g, ''))
  }

  // Parse tooltips first: <tool-tip for="contribution-day-component-X-Y">N contributions on ...</tool-tip>
  const tipCounts = new Map<string, number>()
  const tipRe = /<tool-tip[^>]*for="([^"]+)"[^>]*>(\d+)\s+contribut/gi
  let tm: RegExpExecArray | null
  while ((tm = tipRe.exec(html)) !== null) {
    tipCounts.set(tm[1], parseInt(tm[2]))
  }

  // Parse day cells: data-date="YYYY-MM-DD" id="contribution-day-component-X-Y" data-level="N"
  // Attribute order varies — match either direction
  const dayRe = /data-date="(\d{4}-\d{2}-\d{2})"[^>]*id="(contribution-day-component-[^"]+)"[^>]*data-level="(\d)"/g
  let dm: RegExpExecArray | null
  while ((dm = dayRe.exec(html)) !== null) {
    const date = dm[1]
    const id = dm[2]
    const level = parseInt(dm[3]) as Level
    const count = tipCounts.get(id) ?? 0

    contributions.push({ date, count, level })
  }

  contributions.sort((a, b) => a.date.localeCompare(b.date))

  return {
    total: { [String(year)]: total },
    contributions,
  }
}

// --- Merge multiple users ---

function mergeResponses(responses: FlatResponse[]): FlatResponse {
  const byDate = new Map<string, Contribution>()

  for (const resp of responses) {
    for (const c of resp.contributions) {
      const existing = byDate.get(c.date)
      if (existing) {
        existing.count += c.count
        existing.level = calculateLevel(existing.count)
      } else {
        byDate.set(c.date, { ...c })
      }
    }
  }

  const total: Record<string, number> = {}
  for (const resp of responses) {
    for (const [y, count] of Object.entries(resp.total)) {
      total[y] = (total[y] || 0) + count
    }
  }

  return {
    total,
    contributions: Array.from(byDate.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    ),
  }
}

function calculateLevel(count: number): Level {
  if (count === 0) return 0
  if (count <= 3) return 1
  if (count <= 6) return 2
  if (count <= 9) return 3
  return 4
}

// --- Flat → Nested ---

function toNested(flat: FlatResponse): NestedResponse {
  const nested: NestedContributions = {}

  for (const c of flat.contributions) {
    const [y, m, d] = c.date.split('-')
    nested[y] ??= {}
    nested[y][m] ??= {}
    nested[y][m][d] = c
  }

  return { total: flat.total, contributions: nested }
}
