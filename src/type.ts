export interface DesignSystem {
  //   theme: Theme
  //   utilities: Utilities
  //   variants: Variants

  // invalidCandidates: Set<string>

  // Whether to mark utility declarations as !important
  // important: boolean

  getClassOrder: (classes: string[]) => [string, bigint | null][]
  //   getClassList: () => ClassEntry[]
  //   getVariants: () => VariantEntry[]

  //   parseCandidate: (candidate: string) => Readonly<Candidate>[]
  //   parseVariant: (variant: string) => Readonly<Variant> | null
  //   compileAstNodes: (candidate: Candidate) => ReturnType<typeof compileAstNodes>

  // getVariantOrder: () => Map<Variant, number>
  // resolveThemeValue: (path: string) => string | undefined

  // Used by IntelliSense
  candidatesToCss: (classes: string[]) => (string | null)[]

  tailwindConfig?: {
    separator?: string
    prefix?: string
  }
}
