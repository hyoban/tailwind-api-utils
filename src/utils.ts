import type { Jiti } from 'jiti'
import { dirname } from 'node:path'

import { fileURLToPath } from 'node:url'
import { createJiti } from 'jiti'

const _dirname = typeof __dirname !== 'undefined'
  ? __dirname
  : dirname(fileURLToPath(import.meta.url))

// Attempts to import the module using the native `import()` function. If this
// fails, it sets up `jiti` and attempts to import this way so that `.ts` files
// can be resolved properly.
let jiti: null | Jiti = null
export async function importModule(path: string, pwd?: string): Promise<any> {
  try {
    return await import(path)
  }
  catch {
    jiti ??= createJiti(pwd || _dirname, { moduleCache: false, fsCache: false })
    return await jiti.import(path)
  }
}
