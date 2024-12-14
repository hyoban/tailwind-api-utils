import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path, { dirname } from 'node:path'

import { pathToFileURL } from 'node:url'
import EnhancedResolve from 'enhanced-resolve'

import { importModule } from '../utils'
import { getModuleDependencies } from './get-module-dependencies'

type Resolver = (id: string, base: string) => Promise<string | false | undefined>

export async function loadModule(
  id: string,
  base: string,
  onDependency: (path: string) => void,
  customJsResolver?: Resolver,
): Promise<{ base: string, module: any }> {
  if (id[0] !== '.') {
    const resolvedPath = await resolveJsId(id, base, customJsResolver)
    if (!resolvedPath) {
      throw new Error(`Could not resolve '${id}' from '${base}'`)
    }

    const module = await importModule(pathToFileURL(resolvedPath).href)
    return {
      base: dirname(resolvedPath),
      module: module.default ?? module,
    }
  }

  const resolvedPath = await resolveJsId(id, base, customJsResolver)
  if (!resolvedPath) {
    throw new Error(`Could not resolve '${id}' from '${base}'`)
  }

  const [module, moduleDependencies] = await Promise.all([
    importModule(`${pathToFileURL(resolvedPath).href}?id=${Date.now()}`),
    getModuleDependencies(resolvedPath),
  ])

  for (const file of moduleDependencies) {
    onDependency(file)
  }
  return {
    base: dirname(resolvedPath),
    module: module.default ?? module,
  }
}

export async function loadStylesheet(
  id: string,
  base: string,
  onDependency: (path: string) => void,
  cssResolver?: Resolver,
): Promise<{ base: string, content: string }> {
  const resolvedPath = await resolveCssId(id, base, cssResolver)
  if (!resolvedPath)
    throw new Error(`Could not resolve '${id}' from '${base}'`)

  onDependency(resolvedPath)

  const file = await fsPromises.readFile(resolvedPath, 'utf-8')
  return {
    base: path.dirname(resolvedPath),
    content: file,
  }
}

const cssResolver = EnhancedResolve.ResolverFactory.createResolver({
  fileSystem: new EnhancedResolve.CachedInputFileSystem(fs, 4000),
  useSyncFileSystemCalls: true,
  extensions: ['.css'],
  mainFields: ['style'],
  conditionNames: ['style'],
})
async function resolveCssId(
  id: string,
  base: string,
  customCssResolver?: Resolver,
): Promise<string | false | undefined> {
  if (customCssResolver) {
    const customResolution = await customCssResolver(id, base)
    if (customResolution) {
      return customResolution
    }
  }

  return runResolver(cssResolver, id, base)
}

const esmResolver = EnhancedResolve.ResolverFactory.createResolver({
  fileSystem: new EnhancedResolve.CachedInputFileSystem(fs, 4000),
  useSyncFileSystemCalls: true,
  extensions: ['.js', '.json', '.node', '.ts'],
  conditionNames: ['node', 'import'],
})

const cjsResolver = EnhancedResolve.ResolverFactory.createResolver({
  fileSystem: new EnhancedResolve.CachedInputFileSystem(fs, 4000),
  useSyncFileSystemCalls: true,
  extensions: ['.js', '.json', '.node', '.ts'],
  conditionNames: ['node', 'require'],
})

async function resolveJsId(
  id: string,
  base: string,
  customJsResolver?: Resolver,
): Promise<string | false | undefined> {
  if (customJsResolver) {
    const customResolution = await customJsResolver(id, base)
    if (customResolution) {
      return customResolution
    }
  }

  return runResolver(esmResolver, id, base).catch(() => runResolver(cjsResolver, id, base))
}

function runResolver(
  resolver: EnhancedResolve.Resolver,
  id: string,
  base: string,
): Promise<string | false | undefined> {
  return new Promise((resolve, reject) =>
    resolver.resolve({}, base, id, {}, (err, result) => {
      if (err)
        return reject(err)
      resolve(result)
    }),
  )
}
