import { describe, expect, it } from 'vitest'
import { mayRequest, normalizeCreatorUrl, parseCreatorLinks, parseCreatorRequest, reviewed } from './creatorTag'

describe('normalizeCreatorUrl', () => {
  it('normalizes the platforms’ links, with or without a scheme', () => {
    expect(normalizeCreatorUrl('twitch.tv/Gaules')).toEqual({ platform: 'twitch', url: 'https://twitch.tv/Gaules' })
    expect(normalizeCreatorUrl('  https://www.youtube.com/@WePlay-Z/?si=abc#top ')).toEqual({ platform: 'youtube', url: 'https://youtube.com/@WePlay-Z' })
    expect(normalizeCreatorUrl('https://m.youtube.com/channel/UC123')).toEqual({ platform: 'youtube', url: 'https://youtube.com/channel/UC123' })
    expect(normalizeCreatorUrl('https://youtu.be/dQw4w9WgXcQ')).toEqual({ platform: 'youtube', url: 'https://youtu.be/dQw4w9WgXcQ' })
    expect(normalizeCreatorUrl('KICK.COM/xqc')).toEqual({ platform: 'kick', url: 'https://kick.com/xqc' })
    expect(normalizeCreatorUrl('https://www.tiktok.com/@birdseyegames')).toEqual({ platform: 'tiktok', url: 'https://tiktok.com/@birdseyegames' })
    expect(normalizeCreatorUrl('instagram.com/sylvette')).toEqual({ platform: 'instagram', url: 'https://instagram.com/sylvette' })
    expect(normalizeCreatorUrl('https://twitter.com/ana')).toEqual({ platform: 'x', url: 'https://twitter.com/ana' })
  })

  it('takes any other https site as a `site`, its front page too', () => {
    expect(normalizeCreatorUrl('https://Ana.Example.com.br/videos/?x=1')).toEqual({ platform: 'site', url: 'https://ana.example.com.br/videos' })
    expect(normalizeCreatorUrl('www.ana.dev')).toEqual({ platform: 'site', url: 'https://www.ana.dev' })
    expect(normalizeCreatorUrl('https://bücher.de/ana')?.url).toBe('https://xn--bcher-kva.de/ana')
  })

  it('refuses anything but an https link to a named host (a platform past its front page)', () => {
    for (const bad of [
      'http://twitch.tv/name',
      'javascript:alert(1)',
      'https://twitch.tv',
      'https://twitch.tv/',
      'https://192.168.0.1/name',
      'https://localhost/name',
      'https://[::1]/name',
      'data:text/html,hi',
      'https://user:pass@twitch.tv/name',
      'https://twitch.tv:8443/name',
      `https://twitch.tv/${'a'.repeat(200)}`,
      '',
    ])
      expect(normalizeCreatorUrl(bad), bad).toBeNull()
  })

  it('keeps what could break out of markup percent-encoded', () => {
    expect(normalizeCreatorUrl('https://twitch.tv/na"me<b>')?.url).toBe('https://twitch.tv/na%22me%3Cb%3E')
    expect(normalizeCreatorUrl('https://www.youtube.com/@寶可夢')?.url).toBe('https://youtube.com/@%E5%AF%B6%E5%8F%AF%E5%A4%A2')
  })
})

describe('parseCreatorRequest', () => {
  it('skips blanks, merges repeats and keeps the order', () => {
    expect(parseCreatorRequest(['', 'twitch.tv/ana', 'https://www.twitch.tv/ana/', 'kick.com/ana'])).toEqual({
      ok: true,
      links: [
        { platform: 'twitch', url: 'https://twitch.tv/ana' },
        { platform: 'kick', url: 'https://kick.com/ana' },
      ],
    })
  })

  it('needs one link, at most three, every one valid', () => {
    expect(parseCreatorRequest(['', ' '])).toEqual({ ok: false, error: 'empty' })
    expect(parseCreatorRequest(['twitch.tv/a', 'kick.com/a', 'tiktok.com/@a', 'youtube.com/@a'])).toEqual({ ok: false, error: 'many' })
    expect(parseCreatorRequest(['twitch.tv/a', 'http://instagram.com/a'])).toEqual({ ok: false, error: 'invalid', index: 1 })
    expect(parseCreatorRequest('twitch.tv/a')).toEqual({ ok: false, error: 'many' })
  })
})

describe('parseCreatorLinks', () => {
  it('keeps only links that come out of normalizing as they are', () => {
    expect(parseCreatorLinks([{ platform: 'twitch', url: 'https://twitch.tv/a' }, { platform: 'kick', url: 'https://www.kick.com/a' }, { url: 'javascript:alert(1)' }])).toEqual([
      { platform: 'twitch', url: 'https://twitch.tv/a' },
    ])
    expect(parseCreatorLinks([{ platform: 'twitch', url: 'http://twitch.tv/a' }])).toBeNull()
    expect(parseCreatorLinks('https://twitch.tv/a')).toBeNull()
  })
})

describe('request states', () => {
  it('lets a player ask again only once the last request is settled against them', () => {
    expect(mayRequest(null)).toBe(true)
    expect(mayRequest('rejected')).toBe(true)
    expect(mayRequest('revoked')).toBe(true)
    expect(mayRequest('pending')).toBe(false)
    expect(mayRequest('approved')).toBe(false)
  })

  it('reviews pending requests and revokes approved ones only', () => {
    expect(reviewed('pending', 'approve')).toBe('approved')
    expect(reviewed('pending', 'reject')).toBe('rejected')
    expect(reviewed('approved', 'revoke')).toBe('revoked')
    expect(reviewed('approved', 'approve')).toBeNull()
    expect(reviewed('pending', 'revoke')).toBeNull()
    expect(reviewed('rejected', 'approve')).toBeNull()
    expect(reviewed(null, 'approve')).toBeNull()
  })
})
