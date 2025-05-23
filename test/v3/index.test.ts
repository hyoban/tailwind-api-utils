import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { TailwindUtils } from '../../src/index'

describe('should', () => {
  it('works', async () => {
    const utils = new TailwindUtils()
    await utils.loadConfig(path.resolve(import.meta.dirname, 'tailwind.config.cjs'))

    expect(utils.isValidClassName('bg-red-500')).toBe(true)
    expect(utils.isValidClassName('bg-red-10000')).toBe(false)
    expect(utils.isValidClassName('group')).toBe(true)

    const extractions = utils.extract(`
      <div class="text-center font-bold px-4 pointer-events-none"></div>
    `)
    expect(extractions).toContain('text-center')
    expect(extractions).toContain('font-bold')
    expect(extractions).toContain('px-4')
    expect(extractions).toContain('pointer-events-none')
  })

  it('load config properly', async () => {
    const utils = new TailwindUtils()
    await utils.loadConfig(path.resolve(import.meta.dirname, 'tailwind.config.cjs'))
    expect(utils.context?.tailwindConfig?.content?.files).toMatchInlineSnapshot(`
      [
        "./src/**/*.{html,js}",
      ]
    `)
  })

  it('load config object', async () => {
    const utils = new TailwindUtils()
    await utils.loadConfig({
      content: ['./src/**/*.{html,js}'],
      theme: {
        extend: {},
      },
      plugins: [],
    })
    expect(utils.context?.tailwindConfig?.content?.files).toMatchInlineSnapshot(`
      [
        "./src/**/*.{html,js}",
      ]
    `)
  })
})
