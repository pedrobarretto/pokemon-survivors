import { describe, expect, it } from 'vitest'
import './hansNow'
import { hans, hansDeep } from './hans'

describe('hans', () => {
  it("turns Taiwan's words into the mainland's", () => {
    expect(hans('登入帳號')).toBe('登录账号')
    expect(hans('伺服器設定')).toBe('服务器设置')
    expect(hans('穿過傳送門')).toBe('穿过传送门')
    expect(hans('按空白鍵')).toBe('按空格键')
    expect(hans('Pokémon 3 次')).toBe('Pokémon 3 次')
  })

  it('converts a text table deep, functions included', () => {
    const table = { title: '寶可夢', lines: ['進化'], count: (n: number) => `${n} 隻寶可夢`, n: 3 }
    const out = hansDeep(table)
    expect(out.title).toBe('宝可梦')
    expect(out.lines).toEqual(['进化'])
    expect(out.count(2)).toBe('2 只宝可梦')
    expect(out.n).toBe(3)
  })
})
