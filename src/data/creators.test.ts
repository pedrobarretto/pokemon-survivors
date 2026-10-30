import { describe, expect, it } from 'vitest'
import { CREATOR_VIDEOS, videoOf } from './creators'
import { VIDEO_META } from './creatorVideos.generated'

describe('videoOf', () => {
  it('reads the YouTube and TikTok URLs share buttons give', () => {
    const watch = { platform: 'youtube', id: 'hQpzB5sl2xA', vertical: false }
    expect(videoOf('https://www.youtube.com/watch?v=hQpzB5sl2xA&t=42s')).toEqual(watch)
    expect(videoOf('https://youtu.be/hQpzB5sl2xA?si=abc')).toEqual(watch)
    expect(videoOf('https://m.youtube.com/live/hQpzB5sl2xA')).toEqual(watch)
    expect(videoOf('https://www.youtube.com/embed/hQpzB5sl2xA')).toEqual(watch)
    expect(videoOf('https://youtube.com/shorts/hQpzB5sl2xA')).toEqual({ ...watch, vertical: true })
    expect(videoOf('https://www.tiktok.com/@birdseyegames/video/7431234567890123456?lang=en')).toEqual({ platform: 'tiktok', id: '7431234567890123456', vertical: true })
  })

  it("gives up on what isn't a video", () => {
    expect(videoOf('https://www.youtube.com/@WePlay-Z')).toBeNull()
    expect(videoOf('https://www.tiktok.com/@birdseyegames')).toBeNull()
    expect(videoOf('https://vimeo.com/123')).toBeNull()
    expect(videoOf('not a url')).toBeNull()
  })
})

describe('CREATOR_VIDEOS', () => {
  it('were all fetched by `npm run creators` (the page leaves out a video it has not)', () => {
    for (const { url } of CREATOR_VIDEOS) {
      const video = videoOf(url)
      expect(video && VIDEO_META[video.id], url).toBeTruthy()
    }
  })
})
