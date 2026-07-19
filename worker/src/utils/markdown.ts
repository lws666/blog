/**
 * Minimal frontmatter parser for Markdown
 * Extracts YAML frontmatter between --- markers and returns parsed data + content body.
 */

export interface FrontmatterResult {
  data: Record<string, unknown>
  content: string
}

/**
 * Parse YAML frontmatter from markdown string
 * Supports standard --- delimiters
 */
export function parseFrontmatter(markdown: string): FrontmatterResult {
  const trimmed = markdown.trim()

  // Must start with ---
  if (!trimmed.startsWith('---')) {
    return { data: {}, content: trimmed }
  }

  // Find closing ---
  const endIndex = trimmed.indexOf('---', 3)
  if (endIndex === -1) {
    return { data: {}, content: trimmed }
  }

  const yamlBlock = trimmed.slice(3, endIndex).trim()
  const content = trimmed.slice(endIndex + 3).trim()

  return {
    data: parseYaml(yamlBlock),
    content,
  }
}

/**
 * Minimal YAML parser (handles Valaxy frontmatter subset)
 * Supports: string, number, boolean, array, nested keys
 */
function parseYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const lines = yaml.split('\n')

  let currentKey: string | null = null
  let currentArray: string[] | null = null

  for (const raw of lines) {
    const line = raw.trim()

    // Skip empty / comment lines
    if (!line || line.startsWith('#')) continue

    // Array item: - value
    if (line.startsWith('- ') && currentKey) {
      currentArray = currentArray || []
      currentArray.push(line.slice(2).trim())
      result[currentKey] = currentArray
      continue
    }

    // Close previous array
    if (currentArray && !line.startsWith('- ')) {
      currentArray = null
    }

    // Key: value
    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue

    const key = line.slice(0, colonIndex).trim()
    let value: unknown = line.slice(colonIndex + 1).trim()

    // Empty value (array follows)
    if (value === '') {
      currentKey = key
      currentArray = null
      continue
    }

    currentKey = key
    currentArray = null

    // Inline array: [value1, value2]
    const strVal = String(value)
    if (strVal.startsWith('[') && strVal.endsWith(']')) {
      const inner = strVal.slice(1, -1).trim()
      value = inner ? inner.split(',').map((s: string) => s.trim().replace(/^['"]|['"]$/g, '')) : []
      result[key] = value
      continue
    }

    // Type coercion
    if (value === 'true') value = true
    else if (value === 'false') value = false
    else if (/^\d+$/.test(strVal)) value = Number(strVal)
    else if (/^\d+\.\d+$/.test(strVal)) value = Number(strVal)
    else {
      // Remove surrounding quotes
      if ((strVal.startsWith("'") && strVal.endsWith("'")) || (strVal.startsWith('"') && strVal.endsWith('"'))) {
        value = strVal.slice(1, -1)
      }
    }

    result[key] = value
  }

  return result
}
