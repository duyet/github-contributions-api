# GitHub Contributions API

An API that returns GitHub contribution data by scraping user profiles. Fast, edge-deployed, cached globally.

Live at **[ghca.duyet.net](https://ghca.duyet.net)**.

## API

```
GET /v1/:username
```

### Response

```json
{
  "total": { "lastYear": 10844 },
  "contributions": [
    { "date": "2025-06-08", "count": 2, "level": 1 },
    { "date": "2025-06-09", "count": 4, "level": 1 }
  ]
}
```

### Query Parameters

| Param    | Values                 | Default | Description        |
| -------- | ---------------------- | ------- | ------------------ |
| `y`      | `last`, `all`, `2026` | `all`   | Year(s) to fetch   |
| `format` | `nested`               | flat    | Response format    |

#### Year selection

| Description | Example |
| ----------- | ------- |
| Last 12 months | [/v1/duyet?y=last](https://ghca.duyet.net/v1/duyet?y=last) |
| Specific year | [/v1/duyet?y=2026](https://ghca.duyet.net/v1/duyet?y=2026) |
| Multiple years | [/v1/duyet?y=2024,2025](https://ghca.duyet.net/v1/duyet?y=2024,2025) |
| All years | [/v1/duyet?y=all](https://ghca.duyet.net/v1/duyet?y=all) |

#### Nested format

| Description | Example |
| ----------- | ------- |
| Nested response | [/v1/duyet?format=nested](https://ghca.duyet.net/v1/duyet?format=nested) |

Returns contributions keyed by year → month → day instead of a flat array.

### Multi-account Merge

Combine contributions from multiple accounts. Counts are summed per date, levels recalculated.

| Description | Example |
| ----------- | ------- |
| Comma-separated | [/v1/duyet,duyetbot?y=last](https://ghca.duyet.net/v1/duyet,duyetbot?y=last) |
| Plus-separated | [/v1/duyet+duyetbot?y=last](https://ghca.duyet.net/v1/duyet+duyetbot?y=last) |

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

Responses are cached for 1 hour via Cloudflare Cache API.

## Development

```bash
pnpm install
pnpm dev       # local dev server (wrangler)
pnpm test      # run tests
pnpm deploy    # deploy to Cloudflare
```

## Credits

Based on [github-contributions-api](https://github.com/grubersjoe/github-contributions-api) by [Jonathan Gruber](https://github.com/grubersjoe) ([@grubersjoe](https://github.com/grubersjoe)) — MIT License. Rewrite running on Cloudflare Workers with [Hono](https://hono.dev).

## License

MIT
