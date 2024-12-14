import type { Jiti } from 'jiti'
import { createJiti } from 'jiti'

// Attempts to import the module using the native `import()` function. If this
// fails, it sets up `jiti` and attempts to import this way so that `.ts` files
// can be resolved properly.
let jiti: null | Jiti = null
export async function importModule(path: string): Promise<any> {
  try {
    return await import(path)
  }
  catch {
    jiti ??= createJiti(import.meta.url, { moduleCache: false, fsCache: false })
    return await jiti.import(path)
  }
}
