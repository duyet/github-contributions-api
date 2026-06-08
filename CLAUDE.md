# GitHub Contributions API

Cloudflare Workers rewrite of [grubersjoe/github-contributions-api](https://github.com/grubersjoe/github-contributions-api) by Jonathan Gruber ([@grubersjoe](https://github.com/grubersjoe)), MIT License.

## Stack

- **Runtime**: Cloudflare Workers
- **Framework**: [Hono](https://hono.dev)
- **Caching**: Cloudflare Cache API — 1h TTL
- **Parsing**: regex-based HTML scraper (no external deps)
- **Testing**: Vitest + `@cloudflare/vitest-pool-workers`

## Structure

```
src/
  index.ts      — Hono app, routes, cache middleware
  scraper.ts    — fetch GitHub HTML → parse contributions
  types.ts      — shared types
test/
  scraper.test.ts  — unit tests with mocked fetch
  index.test.ts    — integration tests (live GitHub)
```

## Routes

```
GET /v1/:username              — contributions (all years)
GET /v1/:username?y=last       — last 12 months
GET /v1/:username?y=2026       — specific year
GET /v1/:username?y=2024,2025  — multiple years
GET /v1/:username?format=nested
GET /v1/user1,user2            — merge accounts (comma/plus)
```

## Commands

```bash
pnpm install
pnpm dev       # wrangler dev
pnpm test      # vitest
pnpm deploy    # wrangler deploy
```

## Deploy

- **Production**: `https://ghca.duyet.net`
- **Workers.dev**: `https://github-contributions-api.duyet.workers.dev`
- **CI**: GitHub Actions — lint, test, deploy on push to `master`
