/**
 * On-type formatting for the GraphQL query editor.
 *
 * Computes the correct indentation for the current line after the user types
 * a trigger character (`\n` or `}`). Braces inside strings and comments are
 * ignored so formatting stays correct in all contexts.
 */

export type IndentEdit = {
  /** 1-based line number to re-indent. */
  lineNumber: number
  /** New leading whitespace for that line (replaces existing leading ws). */
  newIndent: string
}

/**
 * Count how many unmatched `{` exist in `text` up to (but not including)
 * `upTo`, ignoring braces inside strings, `#`-comments, and parentheses.
 *
 * Braces inside parentheses (e.g. directive arguments like
 * `@cached(options: {ttl: 300})`) are skipped because they are not
 * GraphQL selection-set braces and should not affect indentation depth.
 */
export function braceDepthAt(text: string, upTo: number): number {
  let depth = 0
  let parenDepth = 0
  let inComment = false
  let inString: '"' | "'" | null = null

  for (let i = 0; i < upTo && i < text.length; i++) {
    const c = text[i]

    if (inComment) {
      if (c === '\n') inComment = false
      continue
    }
    if (inString) {
      if (c === '\\') {
        i++
        continue
      }
      if (c === inString) inString = null
      continue
    }
    if (c === '#') {
      inComment = true
      continue
    }
    if (c === '"' || c === "'") {
      inString = c
      continue
    }
    if (c === '(') {
      parenDepth++
      continue
    }
    if (c === ')') {
      parenDepth = Math.max(0, parenDepth - 1)
      continue
    }
    // Only count braces outside parentheses — braces inside parens
    // are argument values, not selection sets.
    if (parenDepth === 0) {
      if (c === '{') depth++
      if (c === '}') depth = Math.max(0, depth - 1)
    }
  }
  return depth
}

/**
 * Build an indent string for a given depth.
 */
function indentFor(depth: number, indentUnit: string): string {
  return indentUnit.repeat(depth)
}

/**
 * Compute the re-indent edit for the line at `position` after the user typed
 * `ch`.  Returns `null` when no change is needed.
 *
 * @param lines     - The full document split into lines (0-indexed).
 * @param lineIndex - 0-based index of the line being formatted.
 * @param ch        - The character that triggered formatting (`'\n'` or `'}'`).
 * @param indentUnit - One level of indentation (e.g. `'\t'` or `'  '`).
 * @param fullText  - The full document text (used for brace-depth scanning).
 */
export function computeLineIndent(
  lines: string[],
  lineIndex: number,
  ch: string,
  indentUnit: string,
  fullText: string,
): IndentEdit | null {
  if (lineIndex < 0 || lineIndex >= lines.length) return null

  const line = lines[lineIndex]
  const trimmed = line.trimStart()

  // Calculate the character offset where this line starts in fullText.
  let lineStartOffset = 0
  for (let i = 0; i < lineIndex; i++) {
    lineStartOffset += lines[i].length + 1 // +1 for the `\n`
  }

  if (ch === '}') {
    // The `}` was just typed on this line. Re-indent the line so the `}`
    // aligns with the line that contains its matching `{`.
    // Depth *before* this `}` tells us how deep we are; the `}` closes one
    // level, so indent = depth-before - 1.
    const depthBefore = braceDepthAt(fullText, lineStartOffset)
    const targetDepth = Math.max(0, depthBefore - 1)
    const newIndent = indentFor(targetDepth, indentUnit)
    const currentIndent = line.slice(0, line.length - trimmed.length)
    if (currentIndent === newIndent) return null
    return { lineNumber: lineIndex + 1, newIndent }
  }

  if (ch === '\n') {
    // New line was created. Indent based on brace depth at the start of this
    // line (i.e. after all prior text has been scanned).
    const depth = braceDepthAt(fullText, lineStartOffset)

    // If the line already starts with `}`, reduce by one (the `}` will be
    // reformatted by its own trigger, but give a good starting point).
    const startsWithClose = trimmed.startsWith('}')
    const targetDepth = Math.max(0, startsWithClose ? depth - 1 : depth)
    const newIndent = indentFor(targetDepth, indentUnit)
    const currentIndent = line.slice(0, line.length - trimmed.length)
    if (currentIndent === newIndent) return null
    return { lineNumber: lineIndex + 1, newIndent }
  }

  return null
}
