# GitHub Contributions API

> Rewrite of [grubersjoe/github-contributions-api](https://github.com/grubersjoe/github-contributions-api) running on Cloudflare Workers.

An API that returns GitHub contribution data by scraping user profiles. Fast, edge-deployed, cached globally.

## API

Base URL: `https://github-contributions-api.duyet.workers.dev`

```
GET /v1/:username
```

### Response

```json
{
  "total": {
    "lastYear": 729
  },
  "contributions": [
    { "date": "2025-06-08", "count": 0, "level": 0 },
    { "date": "2025-06-09", "count": 1, "level": 1 },
    { "date": "2025-06-10", "count": 5, "level": 2 }
  ]
}
```

### Query Parameters

| Param   | Values                    | Default | Description              |
| ------- | ------------------------- | ------- | ------------------------ |
| `y`     | `last`, `all`, `2024`    | `all`   | Year(s) to fetch         |
| `format`| `nested`                  | flat    | Response format           |

#### Year selection

```shell
/v1/grubersjoe?y=last            # last 12 months
/v1/grubersjoe?y=2024            # specific year
/v1/grubersjoe?y=2023,2024       # multiple years
/v1/grubersjoe?y=all             # all years (default)
```

#### Nested format

```shell
/v1/grubersjoe?format=nested
```

Returns contributions keyed by year → month → day instead of a flat array.

### Multi-account Merge

Combine contributions from multiple accounts in one request:

```shell
/v1/user1,user2
/v1/user1+user2
```

Counts are summed per date, levels recalculated.

### Response Types

```typescript
type Contribution = {
  date: string    // YYYY-MM-DD
  count: number
  level: 0 | 1 | 2 | 3 | 4
}

type Response = {
  total: { [year: string]: number }
  contributions: Contribution[]
}

type NestedResponse = {
  total: { [year: string]: number }
  contributions: {
    [year: string]: {
      [month: string]: {
        [day: string]: Contribution
      }
    }
  }
}
```

## Caching

Responses are cached for 1 hour via Cloudflare Cache API. The API returns standard `Cache-Control` headers.

## Development

```bash
pnpm install
pnpm dev       # local dev server (wrangler)
pnpm test      # run tests
pnpm deploy    # deploy to Cloudflare
```

## Credits

- **Original project**: [github-contributions-api](https://github.com/grubersjoe/github-contributions-api) by [Jonathan Gruber](https://github.com/grubersjoe) — MIT License
- Built with [Hono](https://hono.dev) on [Cloudflare Workers](https://workers.cloudflare.com)

## License

MIT
