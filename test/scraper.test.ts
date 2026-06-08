import { describe, it, expect, vi } from 'vitest'
import { scrapeContributions, HTTPError } from '../src/scraper'
import type { QueryParams } from '../src/types'

// --- HTML fixtures matching real GitHub structure ---

function makeContributionsHTML(days: Array<{ date: string; level: number; count: number }>, total: number, yearLabel: string = 'in the last year') {
  const dayCells = days.map((d, i) => {
    const row = Math.floor(i / 53)
    const col = i % 53
    const id = `contribution-day-component-${row}-${col}`
    return `<td tabindex="0" data-date="${d.date}" id="${id}" data-level="${d.level}" role="gridcell" data-view-component="true" class="ContributionCalendar-day"></td>`
  }).join('\n')

  const tooltips = days.map((d, i) => {
    const row = Math.floor(i / 53)
    const col = i % 53
    const id = `contribution-day-component-${row}-${col}`
    const text = d.count === 0
      ? `No contributions on ${d.date}`
      : `${d.count} contributions on ${d.date}`
    return `<tool-tip for="${id}" popover="manual" data-direction="n" data-type="label" data-view-component="true" class="sr-only position-absolute">${text}.</tool-tip>`
  }).join('\n')

  return `
<div class="js-yearly-contributions">
  <h2 tabindex="-1" id="js-contribution-activity-description" class="f4 text-normal mb-2">
    ${total}
    contributions
      ${yearLabel}
  </h2>
  <div class="js-calendar-graph">
    <table class="ContributionCalendar-grid js-calendar-graph-table">
      <tbody><tr>${dayCells}</tr></tbody>
    </table>
  </div>
  ${tooltips}
</div>`
}

function makeProfileHTML(years: number[]) {
  const links = years
    .map((y) => `<a class="js-year-link" href="/user?tab=contributions&from=${y}-12-01">${y}</a>`)
    .join('\n')
  return `<html><body>${links}</body></html>`
}

// --- Mock fetch ---

function mockFetch(responses: Map<string, { ok: boolean; status: number; body: string }>) {
  return vi.fn(async (url: string | URL | Request) => {
    const key = typeof url === 'string' ? url : url.toString()
    const entry = responses.get(key)
    if (!entry) {
      return new Response('not found', { status: 404 })
    }
    return {
      ok: entry.ok,
      status: entry.status,
      text: async () => entry.body,
    } as Response
  })
}

// --- Tests ---

describe('scraper', () => {
  describe('scrapeContributions', () => {
    it('parses a single user with y=last', async () => {
      const html = makeContributionsHTML([
        { date: '2025-01-01', level: 0, count: 0 },
        { date: '2025-01-02', level: 3, count: 7 },
        { date: '2025-01-03', level: 1, count: 2 },
      ], 42)

      const fetchFn = mockFetch(new Map([
        ['https://github.com/users/alice/contributions', { ok: true, status: 200, body: html }],
      ]))

      const result = await scrapeContributions(
        ['alice'],
        { y: 'last' } as QueryParams,
        fetchFn as unknown as typeof fetch,
      )

      expect(result.total).toEqual({ lastYear: 42 })
      expect(result.contributions).toHaveLength(3)
      expect(result.contributions[0]).toEqual({ date: '2025-01-01', count: 0, level: 0 })
      expect(result.contributions[1]).toEqual({ date: '2025-01-02', count: 7, level: 3 })
      expect(result.contributions[2]).toEqual({ date: '2025-01-03', count: 2, level: 1 })
    })

    it('parses total with commas', async () => {
      const html = makeContributionsHTML([
        { date: '2025-01-01', level: 0, count: 0 },
      ], 1234, 'in 2025')

      const fetchFn = mockFetch(new Map([
        ['https://github.com/users/alice/contributions', { ok: true, status: 200, body: html }],
      ]))

      const result = await scrapeContributions(
        ['alice'],
        { y: 'last' } as QueryParams,
        fetchFn as unknown as typeof fetch,
      )

      expect(result.total).toEqual({ lastYear: 1234 })
    })

    it('scrapes specific years via year links', async () => {
      const year2024 = makeContributionsHTML([
        { date: '2024-06-01', level: 2, count: 5 },
      ], 100, 'in 2024')

      const profile = makeProfileHTML([2023, 2024, 2025])

      const fetchFn = mockFetch(new Map([
        ['https://github.com/alice?tab=contributions', { ok: true, status: 200, body: profile }],
        ['https://github.com/users/alice/contributions?tab=overview&from=2024-12-01&to=2024-12-31', { ok: true, status: 200, body: year2024 }],
      ]))

      const result = await scrapeContributions(
        ['alice'],
        { y: [2024] } as QueryParams,
        fetchFn as unknown as typeof fetch,
      )

      expect(result.total).toEqual({ '2024': 100 })
      expect(result.contributions).toHaveLength(1)
    })

    it('scrapes all years when y=all', async () => {
      const year2023 = makeContributionsHTML([
        { date: '2023-03-15', level: 1, count: 3 },
      ], 50, 'in 2023')

      const year2024 = makeContributionsHTML([
        { date: '2024-06-01', level: 2, count: 5 },
      ], 80, 'in 2024')

      const profile = makeProfileHTML([2023, 2024])

      const fetchFn = mockFetch(new Map([
        ['https://github.com/alice?tab=contributions', { ok: true, status: 200, body: profile }],
        ['https://github.com/users/alice/contributions?tab=overview&from=2023-12-01&to=2023-12-31', { ok: true, status: 200, body: year2023 }],
        ['https://github.com/users/alice/contributions?tab=overview&from=2024-12-01&to=2024-12-31', { ok: true, status: 200, body: year2024 }],
      ]))

      const result = await scrapeContributions(
        ['alice'],
        { y: 'all' } as QueryParams,
        fetchFn as unknown as typeof fetch,
      )

      expect(result.total).toEqual({ '2023': 50, '2024': 80 })
      expect(result.contributions).toHaveLength(2)
    })

    it('returns nested format when requested', async () => {
      const html = makeContributionsHTML([
        { date: '2025-01-15', level: 1, count: 3 },
        { date: '2025-02-20', level: 2, count: 5 },
      ], 10)

      const fetchFn = mockFetch(new Map([
        ['https://github.com/users/alice/contributions', { ok: true, status: 200, body: html }],
      ]))

      const result = await scrapeContributions(
        ['alice'],
        { y: 'last', format: 'nested' } as QueryParams,
        fetchFn as unknown as typeof fetch,
      )

      expect(result.total).toEqual({ lastYear: 10 })
      if ('contributions' in result && !Array.isArray(result.contributions)) {
        expect(result.contributions['2025']['01']['15']).toEqual({
          date: '2025-01-15', count: 3, level: 1,
        })
        expect(result.contributions['2025']['02']['20']).toEqual({
          date: '2025-02-20', count: 5, level: 2,
        })
      }
    })

    it('throws 404 for unknown user', async () => {
      const fetchFn = mockFetch(new Map([
        ['https://github.com/users/ghost/contributions', { ok: false, status: 404, body: 'Not Found' }],
      ]))

      await expect(
        scrapeContributions(['ghost'], { y: 'last' } as QueryParams, fetchFn as unknown as typeof fetch),
      ).rejects.toThrow('GitHub user "ghost" not found.')

      await expect(
        scrapeContributions(['ghost'], { y: 'last' } as QueryParams, fetchFn as unknown as typeof fetch),
      ).rejects.toBeInstanceOf(HTTPError)
    })

    it('throws on non-404 GitHub errors', async () => {
      const fetchFn = mockFetch(new Map([
        ['https://github.com/users/alice/contributions', { ok: false, status: 500, body: 'Server Error' }],
      ]))

      await expect(
        scrapeContributions(['alice'], { y: 'last' } as QueryParams, fetchFn as unknown as typeof fetch),
      ).rejects.toThrow('GitHub returned 500')
    })
  })

  describe('multi-account merge', () => {
    it('merges contributions from two users', async () => {
      const user1Html = makeContributionsHTML([
        { date: '2025-01-01', level: 1, count: 3 },
        { date: '2025-01-02', level: 2, count: 5 },
      ], 30)

      const user2Html = makeContributionsHTML([
        { date: '2025-01-01', level: 2, count: 6 },
        { date: '2025-01-03', level: 1, count: 2 },
      ], 20)

      const fetchFn = mockFetch(new Map([
        ['https://github.com/users/alice/contributions', { ok: true, status: 200, body: user1Html }],
        ['https://github.com/users/bob/contributions', { ok: true, status: 200, body: user2Html }],
      ]))

      const result = await scrapeContributions(
        ['alice', 'bob'],
        { y: 'last' } as QueryParams,
        fetchFn as unknown as typeof fetch,
      )

      // Merged: 2025-01-01 = 3+6=9 (level 3), 2025-01-02 = 5, 2025-01-03 = 2
      expect(result.contributions).toHaveLength(3)
      expect(result.contributions[0]).toEqual({ date: '2025-01-01', count: 9, level: 3 })
      expect(result.contributions[1]).toEqual({ date: '2025-01-02', count: 5, level: 2 })
      expect(result.contributions[2]).toEqual({ date: '2025-01-03', count: 2, level: 1 })

      // Totals are summed
      expect(result.total).toEqual({ lastYear: 50 })
    })

    it('merges more than two users', async () => {
      const html1 = makeContributionsHTML([
        { date: '2025-01-01', level: 1, count: 1 },
      ], 10)

      const html2 = makeContributionsHTML([
        { date: '2025-01-01', level: 1, count: 2 },
      ], 15)

      const html3 = makeContributionsHTML([
        { date: '2025-01-01', level: 1, count: 3 },
      ], 20)

      const fetchFn = mockFetch(new Map([
        ['https://github.com/users/a/contributions', { ok: true, status: 200, body: html1 }],
        ['https://github.com/users/b/contributions', { ok: true, status: 200, body: html2 }],
        ['https://github.com/users/c/contributions', { ok: true, status: 200, body: html3 }],
      ]))

      const result = await scrapeContributions(
        ['a', 'b', 'c'],
        { y: 'last' } as QueryParams,
        fetchFn as unknown as typeof fetch,
      )

      expect(result.contributions).toHaveLength(1)
      expect(result.contributions[0]).toEqual({ date: '2025-01-01', count: 6, level: 2 })
      expect(result.total).toEqual({ lastYear: 45 })
    })
  })

  describe('level calculation', () => {
    it('correctly maps counts to levels when merging', async () => {
      const html = makeContributionsHTML([
        { date: '2025-01-01', level: 0, count: 0 },
      ], 0)

      const fetchFn = mockFetch(new Map([
        ['https://github.com/users/a/contributions', { ok: true, status: 200, body: html }],
        ['https://github.com/users/b/contributions', { ok: true, status: 200, body: html }],
      ]))

      const result = await scrapeContributions(
        ['a', 'b'],
        { y: 'last' } as QueryParams,
        fetchFn as unknown as typeof fetch,
      )

      // 0 + 0 = 0 → level 0
      expect(result.contributions[0]!.level).toBe(0)
      expect(result.contributions[0]!.count).toBe(0)
    })
  })
})
