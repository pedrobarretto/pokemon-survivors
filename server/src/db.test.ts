import { describe, expect, it, vi } from 'vitest'
import { retrying } from './db'

describe('retrying', () => {
  it('tries again after a failure and returns what the task finally gave', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let calls = 0
    const task = async () => {
      calls++
      if (calls < 3) throw new Error('canceling statement due to statement timeout')
      return 'done'
    }
    await expect(retrying('boot', task, 5, 0)).resolves.toBe('done')
    expect(calls).toBe(3)
  })

  it('gives up with the last error after its attempts', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let calls = 0
    const task = async () => {
      calls++
      throw new Error(`failure ${calls}`)
    }
    await expect(retrying('boot', task, 3, 0)).rejects.toThrow('failure 3')
    expect(calls).toBe(3)
  })
})
