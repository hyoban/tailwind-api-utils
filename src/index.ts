import type { PackageResolvingOptions } from 'local-pkg'
import type { DesignSystem } from './type'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { getPackageInfoSync, resolveModule } from 'local-pkg'
import { defaultExtractor as defaultExtractorLocal } from './extractor/defaultExtractor'
import { importModule } from './utils'
import { loadModule, loadStylesheet } from './v4/load'

export class TailwindUtils {
  private designSystem: DesignSystem | null = null
  private packageInfo: Exclude<ReturnType<typeof getPackageInfoSync>, undefined>
  private isV4 = false
  private extractor: ((content: string) => string[]) | null = null

  constructor() {
    const res = getPackageInfoSync('tailwindcss')
    if (!res) {
      throw new Error('Could not find tailwindcss')
    }
    this.packageInfo = res
    this.isV4 = !!this.packageInfo.version?.startsWith('4')
  }

  async loadConfig(configPath: string, options?: PackageResolvingOptions): Promise<void> {
    const tailwindLibPath = resolveModule('tailwindcss', options)
    if (!tailwindLibPath)
      throw new Error('Could not resolve tailwindcss')

    if (this.isV4) {
      const tailwindMod = await importModule(tailwindLibPath)
      const { __unstable__loadDesignSystem } = tailwindMod

      const defaultCSSThemePath = resolveModule('tailwindcss/theme.css', options)
      if (!defaultCSSThemePath)
        throw new Error('Could not resolve tailwindcss theme')
      const defaultCSSTheme = await fsp.readFile(defaultCSSThemePath, 'utf-8')

      const css = await fsp.readFile(configPath, 'utf-8')
      const base = path.dirname(configPath)

      this.designSystem = await __unstable__loadDesignSystem(
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
      const { createContext } = await importModule(
        path.resolve(tailwindLibPath, '../lib/setupContextUtils.js'),
      )
      const { default: resolveConfig } = await importModule(
        path.resolve(tailwindLibPath, '../../resolveConfig.js'),
      )
      const { defaultExtractor } = await importModule(
        path.resolve(tailwindLibPath, '../lib/defaultExtractor.js'),
      )

      const config = resolveConfig(await importModule(configPath))
      this.designSystem = createContext(config)

      const extractorContext = {
        tailwindConfig: {
          separator: '-',
          prefix: '',
        },
      }
      if (this.designSystem?.tailwindConfig?.separator) {
        extractorContext.tailwindConfig.separator = this.designSystem.tailwindConfig.separator
      }
      if (this.designSystem?.tailwindConfig?.prefix) {
        extractorContext.tailwindConfig.prefix = this.designSystem.tailwindConfig.prefix
      }

      this.extractor = defaultExtractor(extractorContext)
    }
  }

  isValidClassName(className: string): boolean
  isValidClassName(className: string[]): boolean[]
  isValidClassName(className: string | string[]): boolean | boolean[] {
    const input = Array.isArray(className) ? className : [className]

    const res = this.designSystem?.getClassOrder(input)
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
