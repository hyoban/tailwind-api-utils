import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { TailwindUtils } from '../../src/index'

describe('should', () => {
  it('works', async () => {
    const utils = new TailwindUtils()
    await utils.loadConfig(path.resolve(import.meta.dirname, 'tailwind.css'))

    expect(utils.isValidClassName('bg-red-500')).toBe(true)
    expect(utils.isValidClassName('bg-red-10000')).toBe(false)
    expect(utils.isValidClassName('group')).toBe(false)
  })
})
