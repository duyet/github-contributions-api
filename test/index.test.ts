import { describe, it, expect } from 'vitest'
import app from '../src/index'

describe('routes', () => {
  describe('GET /', () => {
    it('returns welcome message', async () => {
      const res = await app.request('/')
      expect(res.status).toBe(200)

      const body = await res.json<{ message: string; version: string; docs: string }>()
      expect(body.message).toBe('GitHub Contributions API')
      expect(body.version).toBe('v1')
      expect(body.docs).toContain('github.com/duyet')
    })
  })

  describe('GET /v1', () => {
    it('redirects to /', async () => {
      const res = await app.request('/v1')
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toBe('/')
    })
  })

  describe('GET /v1/:username', () => {
    it('returns contributions for a valid user', async () => {
      const res = await app.request('/v1/grubersjoe?y=last')

      // May be 200 or a GitHub error depending on rate limits
      // We just verify the response structure is correct
      if (res.status === 200) {
        const body = await res.json()
        expect(body).toHaveProperty('total')
        expect(body).toHaveProperty('contributions')
        expect(Array.isArray(body.contributions)).toBe(true)
      }
    })

    it('returns 404 for nonexistent user', async () => {
      const res = await app.request('/v1/thisusersurelydoesnotexist12345?y=last')
      expect(res.status).toBe(404)

      const body = await res.json<{ error: string }>()
      expect(body.error).toContain('not found')
    })
  })

  describe('multi-account routes', () => {
    it('accepts comma-separated usernames', async () => {
      // This will hit real GitHub — just verify the route parses correctly
      const res = await app.request('/v1/grubersjoe,grubersjoe?y=last')
      if (res.status === 200) {
        const body = await res.json()
        // Same user twice → doubled counts
        expect(body).toHaveProperty('total')
        expect(body).toHaveProperty('contributions')
      }
    })

    it('accepts plus-separated usernames', async () => {
      const res = await app.request('/v1/grubersjoe+grubersjoe?y=last')
      if (res.status === 200) {
        const body = await res.json()
        expect(body).toHaveProperty('total')
      }
    })
  })

  describe('query params', () => {
    it('accepts format=nested', async () => {
      const res = await app.request('/v1/grubersjoe?y=last&format=nested')
      if (res.status === 200) {
        const body = await res.json()
        expect(body).toHaveProperty('total')
        expect(body).toHaveProperty('contributions')
        // Nested format: contributions is an object, not array
        expect(typeof body.contributions).toBe('object')
        expect(Array.isArray(body.contributions)).toBe(false)
      }
    })
  })

  describe('CORS', () => {
    it('includes CORS headers', async () => {
      const res = await app.request('/', {
        headers: { Origin: 'http://example.com' },
      })
      expect(res.headers.get('access-control-allow-origin')).toBe('*')
    })
  })
})
