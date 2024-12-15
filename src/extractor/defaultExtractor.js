// https://github.com/tailwindlabs/tailwindcss/blob/f875ab9706cae8262e15e5b382580fc8e2d4197f/src/lib/defaultExtractor.js#L4

import * as regex from './regex'
import { splitAtTopLevelOnly } from './splitAtTopLevelOnly'

export function defaultExtractor(context) {
  const patterns = Array.from(buildRegExps(context))

  /**
   * @param {string} content
   */
  return (content) => {
    /** @type {(string|string)[]} */
    const results = []

    for (const pattern of patterns) {
      for (const result of content.match(pattern) ?? []) {
        results.push(clipAtBalancedParens(result))
      }
    }

    // Extract any subclasses from languages like Slim and Pug, eg:
    // div.flex.px-5.underline
    for (const result of results.slice()) {
      const segments = splitAtTopLevelOnly(result, '.')

      for (let idx = 0; idx < segments.length; idx++) {
        const segment = segments[idx]
        if (idx >= segments.length - 1) {
          results.push(segment)
          continue
        }

        // If the next segment is a number, discard both, for example seeing
        // `px-1` and `5` means the real candidate was `px-1.5` which is already
        // captured.
        const next = Number(segments[idx + 1])
        if (Number.isNaN(next)) {
          results.push(segment)
        }
        else {
          idx++
        }
      }
    }

    return results
  }
}

function* buildRegExps(context) {
  const separator = context.tailwindConfig.separator
  const prefix
    = context.tailwindConfig.prefix !== ''
      ? regex.optional(regex.pattern([/-?/, regex.escape(context.tailwindConfig.prefix)]))
      : ''

  const utility = regex.any([
    // Arbitrary properties (without square brackets)
    /\[[^\s:'"`]+:[^\s[\]]+\]/,

    // Arbitrary properties with balanced square brackets
    // This is a targeted fix to continue to allow theme()
    // with square brackets to work in arbitrary properties
    // while fixing a problem with the regex matching too much
    // eslint-disable-next-line regexp/no-super-linear-backtracking
    /\[[^\s:'"`\]]+:\S+?\[\S+\]\S+?\]/,

    // Utilities
    regex.pattern([
      // Utility Name / Group Name
      regex.any([
        /-?\w+/,

        // This is here to make sure @container supports everything that other utilities do
        /@\w+/,
      ]),

      // Normal/Arbitrary values
      regex.optional(
        regex.any([
          regex.pattern([
            // Arbitrary values
            regex.any([
              /-(?:\w+-)*\['\S+'\]/,
              /-(?:\w+-)*\["\S+"\]/,
              /-(?:\w+-)*\[`\S+`\]/,
              /-(?:\w+-)*\[(?:[^\s[\]]+\[[^\s[\]]+\])*[^\s:[\]]+\]/,
            ]),

            // Not immediately followed by an `{[(`
            /(?![{([]\])/,

            // optionally followed by an opacity modifier
            /(?:\/[^\s'"`\\><$]*)?/,
          ]),

          regex.pattern([
            // Arbitrary values
            regex.any([
              /-(?:\w+-)*\['\S+'\]/,
              /-(?:\w+-)*\["\S+"\]/,
              /-(?:\w+-)*\[`\S+`\]/,
              /-(?:\w+-)*\[(?:[^\s[\]]+\[[^\s[\]]+\])*[^\s[\]]+\]/,
            ]),

            // Not immediately followed by an `{[(`
            /(?![{([]\])/,

            // optionally followed by an opacity modifier
            /(?:\/[^\s'"`\\$]*)?/,
          ]),

          // Normal values w/o quotes — may include an opacity modifier
          /[-/][^\s'"`\\$={><]*/,
        ]),
      ),
    ]),
  ])

  const variantPatterns = [
    // Without quotes
    regex.any([
      // This is here to provide special support for the `@` variant
      regex.pattern([/@\[[^\s"'`]+\](\/[^\s"'`]+)?/, separator]),

      // With variant modifier (e.g.: group-[..]/modifier)
      regex.pattern([/([^\s"'`[\\]+-)?\[[^\s"'`]+\]\/[\w-]+/, separator]),

      regex.pattern([/([^\s"'`[\\]+-)?\[[^\s"'`]+\]/, separator]),
      regex.pattern([/[^\s"'`[\\]+/, separator]),
    ]),

    // With quotes allowed
    regex.any([
      // With variant modifier (e.g.: group-[..]/modifier)
      regex.pattern([/([^\s"'`[\\]+-)?\[[^\s`]+\]\/[\w-]+/, separator]),

      regex.pattern([/([^\s"'`[\\]+-)?\[[^\s`]+\]/, separator]),
      regex.pattern([/[^\s`[\\]+/, separator]),
    ]),
  ]

  for (const variantPattern of variantPatterns) {
    yield regex.pattern([
      // Variants
      '((?=((',
      variantPattern,
      ')+))\\2)?',

      // Important (optional)
      /!?/,

      prefix,

      utility,
    ])
  }

  // 5. Inner matches
  yield /[^<>"'`\s.(){}[\]#=%$][^<>"'`\s(){}[\]#=%$]*[^<>"'`\s.(){}[\]#=%:$]/g
}

// We want to capture any "special" characters
// AND the characters immediately following them (if there is one)
const SPECIALS = /([[\]'"`])([^[\]'"`])?/g
const ALLOWED_CLASS_CHARACTERS = /[^"'`\s<>\]]+/

/**
 * Clips a string ensuring that parentheses, quotes, etc… are balanced
 * Used for arbitrary values only
 *
 * We will go past the end of the balanced parens until we find a non-class character
 *
 * Depth matching behavior:
 * w-[calc(100%-theme('spacing[some_key][1.5]'))]']
 *   ┬    ┬          ┬┬       ┬        ┬┬   ┬┬┬┬┬┬┬
 *   1    2          3        4        34   3 210 END
 *   ╰────┴──────────┴────────┴────────┴┴───┴─┴┴┴
 *
 * @param {string} input
 */
function clipAtBalancedParens(input) {
  // We are care about this for arbitrary values
  if (!input.includes('-[')) {
    return input
  }

  let depth = 0
  const openStringTypes = []

  // Find all parens, brackets, quotes, etc
  // Stop when we end at a balanced pair
  // This is naive and will treat mismatched parens as balanced
  // This shouldn't be a problem in practice though
  let matches = input.matchAll(SPECIALS)

  // We can't use lookbehind assertions because we have to support Safari
  // So, instead, we've emulated it using capture groups and we'll re-work the matches to accommodate
  matches = Array.from(matches).flatMap((match) => {
    const [, ...groups] = match

    return groups.map((group, idx) =>
      Object.assign([], match, {
        index: match.index + idx,
        0: group,
      }),
    )
  })

  for (const match of matches) {
    const char = match[0]
    const inStringType = openStringTypes[openStringTypes.length - 1]

    if (char === inStringType) {
      openStringTypes.pop()
    }
    else if (char === '\'' || char === '"' || char === '`') {
      openStringTypes.push(char)
    }

    if (inStringType) {
      continue
    }
    else if (char === '[') {
      depth++
      continue
    }
    else if (char === ']') {
      depth--
      continue
    }

    // We've gone one character past the point where we should stop
    // This means that there was an extra closing `]`
    // We'll clip to just before it
    if (depth < 0) {
      return input.substring(0, match.index - 1)
    }

    // We've finished balancing the brackets but there still may be characters that can be included
    // For example in the class `text-[#336699]/[.35]`
    // The depth goes to `0` at the closing `]` but goes up again at the `[`

    // If we're at zero and encounter a non-class character then we clip the class there
    if (depth === 0 && !ALLOWED_CLASS_CHARACTERS.test(char)) {
      return input.substring(0, match.index)
    }
  }

  return input
}

// Regular utilities
// {{modifier}:}*{namespace}{-{suffix}}*{/{opacityModifier}}?

// Arbitrary values
// {{modifier}:}*{namespace}-[{arbitraryValue}]{/{opacityModifier}}?
// arbitraryValue: no whitespace, balanced quotes unless within quotes, balanced brackets unless within quotes

// Arbitrary properties
// {{modifier}:}*[{validCssPropertyName}:{arbitraryValue}]
