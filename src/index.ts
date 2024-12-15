/* eslint-disable ts/no-require-imports */
import type { PackageResolvingOptions } from 'local-pkg'
import type { DesignSystem } from './type'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { getPackageInfoSync, resolveModule } from 'local-pkg'
import { defaultExtractor as defaultExtractorLocal } from './extractor/defaultExtractor'
import { importModule } from './utils'
import { loadModule, loadStylesheet } from './v4/load'

export class TailwindUtils {
  public context: DesignSystem | null = null
  private packageInfo: ReturnType<typeof getPackageInfoSync>
  private isV4 = false
  private extractor: ((content: string) => string[]) | null = null

  async loadConfig(configPath: string, options?: { pwd?: string }): Promise<void> {
    const { pwd } = options || {}
    const packageResolvingOptions: PackageResolvingOptions = { paths: pwd ? [pwd] : [] }
    const res = getPackageInfoSync('tailwindcss', packageResolvingOptions)
    if (!res) {
      throw new Error('Could not find tailwindcss')
    }
    this.packageInfo = res
    this.isV4 = !!this.packageInfo.version?.startsWith('4')

    const tailwindLibPath = resolveModule('tailwindcss', packageResolvingOptions)
    if (!tailwindLibPath)
      throw new Error('Could not resolve tailwindcss')

    if (this.isV4) {
      const tailwindMod = await importModule(tailwindLibPath, pwd)
      const { __unstable__loadDesignSystem } = tailwindMod

      const defaultCSSThemePath = resolveModule('tailwindcss/theme.css', packageResolvingOptions)
      if (!defaultCSSThemePath)
        throw new Error('Could not resolve tailwindcss theme')
      const defaultCSSTheme = await fsp.readFile(defaultCSSThemePath, 'utf-8')

      const css = await fsp.readFile(configPath, 'utf-8')
      const base = path.dirname(configPath)

      this.context = await __unstable__loadDesignSystem(
        `${defaultCSSTheme}\n${css}`,
        {
          base,
          async loadModule(id: any, base: any) {
            return loadModule(id, base, () => {})
          },
          async loadStylesheet(id: any, base: any) {
            return loadStylesheet(id, base, () => {})
          },
        },
      )

      const extractorContext = {
        tailwindConfig: {
          separator: '-',
          prefix: '',
        },
      }
      this.extractor = defaultExtractorLocal(extractorContext)
    }
    else {
      const { createContext } = require(
        path.resolve(tailwindLibPath, '../lib/setupContextUtils.js'),
      )
      const resolveConfig = require(
        path.resolve(tailwindLibPath, '../../resolveConfig.js'),
      )
      const { defaultExtractor } = require(
        path.resolve(tailwindLibPath, '../lib/defaultExtractor.js'),
      )

      const config = resolveConfig(await importModule(configPath, pwd))
      this.context = createContext(config)

      const extractorContext = {
        tailwindConfig: {
          separator: '-',
          prefix: '',
        },
      }
      if (this.context?.tailwindConfig?.separator) {
        extractorContext.tailwindConfig.separator = this.context.tailwindConfig.separator
      }
      if (this.context?.tailwindConfig?.prefix) {
        extractorContext.tailwindConfig.prefix = this.context.tailwindConfig.prefix
      }

      this.extractor = defaultExtractor(extractorContext)
    }
  }

  isValidClassName(className: string): boolean
  isValidClassName(className: string[]): boolean[]
  isValidClassName(className: string | string[]): boolean | boolean[] {
    const input = Array.isArray(className) ? className : [className]

    const res = this.context?.getClassOrder(input)
    if (!res) {
      throw new Error('Failed to get class order')
    }

    return Array.isArray(className)
      ? res.map(r => r[1] !== null)
      : res[0][1] !== null
  }

  extract(content: string): string[] {
    if (!this.extractor) {
      throw new Error('Extractor is not available')
    }

    return this.extractor(content)
  }
}
