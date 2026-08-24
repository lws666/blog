/**
 * Workers AI helper — article summarisation.
 *
 * Model choice: @cf/meta/llama-3.2-3b-instruct
 *   - Covered by the Workers AI free allocation (10k neurons/day);
 *     one summary costs roughly 9 neurons, so ~1000 summaries/day.
 *   - Handles Simplified Chinese correctly. The 1b variant was tested and
 *     hallucinated details, while the reasoning models (qwen3-30b,
 *     glm-4.7-flash) spend the token budget on a `reasoning` field and
 *     return an empty `response`, so they are unsuitable here.
 */

/** Model id used for summaries */
export const SUMMARY_MODEL = '@cf/meta/llama-3.2-3b-instruct'

/** Max characters of article body fed to the model (keeps well inside context) */
const MAX_INPUT_CHARS = 6000

/** Target summary length in Chinese characters */
const TARGET_CHARS = 100

const SYSTEM_PROMPT = [
  '你是博客文章摘要助手。请阅读文章后用简体中文写一段概括性摘要。',
  '要求：',
  `1. ${TARGET_CHARS} 字以内，一段话，不要换行`,
  '2. 概括文章整体内容与结论，不要照抄开头段落',
  '3. 客观陈述，不要出现「本文」「这篇文章」等字样',
  '4. 只输出摘要正文，不要标题、前缀、引号或 Markdown 标记',
].join('\n')

export interface SummaryResult {
  summary: string
  model: string
  neurons: number
}

/**
 * Generate a summary for one article.
 * Throws when the model returns nothing usable.
 */
export async function summarizePost(
  ai: Ai,
  input: { title: string; content: string },
): Promise<SummaryResult> {
  const body = stripMarkdown(input.content).slice(0, MAX_INPUT_CHARS)

  if (body.length < 50) {
    throw new Error('Article too short to summarise')
  }

  const res = (await ai.run(SUMMARY_MODEL as keyof AiModels, {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `文章标题：${input.title}\n\n正文：\n${body}` },
    ],
    max_tokens: 400,
    temperature: 0.3,
  } as never)) as { response?: string; usage?: { neurons?: number } }

  const summary = cleanOutput(res?.response ?? '')

  if (!summary) {
    throw new Error('Model returned an empty summary')
  }

  return {
    summary,
    model: SUMMARY_MODEL,
    neurons: res?.usage?.neurons ?? 0,
  }
}

/**
 * Reduce Markdown to plain prose so the model spends its context on content
 * rather than syntax. Also drops frontmatter, code blocks and HTML.
 */
function stripMarkdown(md: string): string {
  return md
    // Frontmatter
    .replace(/^---[\s\S]*?\n---/, '')
    // Fenced code blocks (usually noise for a summary)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    // HTML tags (e.g. embedded <video>)
    .replace(/<[^>]+>/g, ' ')
    // Images first, then links → keep link text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // Headings, quotes, list markers
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s{0,3}[-*+]\s+/gm, '')
    // Emphasis / inline code markers
    .replace(/[*_`]+/g, '')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Strip wrapper text the model sometimes adds despite the prompt.
 */
function cleanOutput(raw: string): string {
  let s = raw.trim()

  // Drop a leading label such as "摘要：" / "Summary:"
  s = s.replace(/^(摘要|总结|概要|Summary)\s*[:：]\s*/i, '')

  // Drop surrounding quotes
  s = s.replace(/^["'「『“](.*)["'」』”]$/s, '$1')

  // Keep it to a single paragraph
  s = s.replace(/\s*\n+\s*/g, ' ').trim()

  return s
}
