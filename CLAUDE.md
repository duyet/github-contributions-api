# GitHub Contributions API — Cloudflare Workers

Rewrite of [grubersjoe/github-contributions-api](https://github.com/grubersjoe/github-contributions-api) for Cloudflare Workers using Hono.

## Credits

- **Original project**: [github-contributions-api](https://github.com/grubersjoe/github-contributions-api) by Jonathan Gruber ([@grubersjoe](https://github.com/grubersjoe))
- **License**: MIT

## Architecture

- **Runtime**: Cloudflare Workers (edge)
- **Framework**: [Hono](https://hono.dev)
- **Caching**: Cloudflare Cache API (`caches.default`) — 1 hour TTL
- **HTML Parsing**: `HTMLRewriter` (Cloudflare built-in, streaming)
- **No external deps** beyond Hono

## Project Structure

```
src/
  index.ts      — Hono app, routes, entry point
  scraper.ts    — GitHub contribution scraper (HTMLRewriter-based)
  types.ts      — Shared types
test/
  scraper.test.ts
  index.test.ts
```

## API

```
GET /v1/:username
GET /v1/:username?y=last
GET /v1/:username?y=2024
GET /v1/:username?y=2023&y=2024
GET /v1/:username?format=nested
GET /v1/user1,user2          # merge multiple accounts
GET /v1/user1+user2
```

## Development

```bash
pnpm install
pnpm dev       # wrangler dev
pnpm test      # vitest
pnpm deploy    # wrangler deploy
```
