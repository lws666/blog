/**
 * Markdown 渲染 —— 后端返回的 content 是「带 frontmatter 的 Markdown 原文」，
 * 这里先剔除 frontmatter，再用 marked 渲染为 HTML。
 *
 * 安全性：文章全部由站长本人（管理员令牌）撰写，输入可信；
 * 但仍做基础的 <script> 剥离，避免误粘贴。
 */
import { marked } from 'marked'

marked.setOptions({ gfm: true, breaks: false })

/** 去掉 YAML frontmatter（仅当文件**开头**就是 --- ... --- 时） */
export function stripFrontmatter(md: string): string {
  if (!md) return ''
  // 必须用「行级解析」而不是正则 [\s\S]*?：正文里常见 --- 水平线，
  // 非贪婪正则会匹配到正文第一个 --- 就提前结束，剥离不完整。
  const lines = md.replace(/^\uFEFF/, '').split(/\r?\n/)
  if (lines[0]?.trim() !== '---') return md
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') return lines.slice(i + 1).join('\n')
  }
  return md
}

/** 渲染为 HTML */
export function renderMarkdown(md: string): string {
  const body = stripFrontmatter(md)
  let html = marked.parse(body) as string
  // 正文里的 h1 降为 h2：文章标题已由页头 <h1> 承担，
  // 每页必须只有一个 h1（SEO 红线）
  html = demoteH1(html)
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
}

/** 把正文中的 h1 依次降级为 h2（含闭合标签） */
export function demoteH1(html: string): string {
  return html
    .replace(/<h1(\s[^>]*)?>/gi, '<h2$1>')
    .replace(/<\/h1>/gi, '</h2>')
}

/** 从 HTML 提取 h2/h3 目录 */
export function extractToc(html: string): { id: string, text: string, level: number }[] {
  const out: { id: string, text: string, level: number }[] = []
  const re = /<h([23])[^>]*>([\s\S]*?)<\/h\1>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const level = Number(m[1])
    const text = m[2].replace(/<[^>]+>/g, '').trim()
    if (text) out.push({ id: slugifyHeading(text), text, level })
  }
  return out
}

/** 给标题注入 id（目录锚点） */
export function addHeadingIds(html: string): string {
  return html.replace(/<h([23])([^>]*)>([\s\S]*?)<\/h\1>/gi, (full, lvl, attrs, inner) => {
    const text = String(inner).replace(/<[^>]+>/g, '').trim()
    if (!text) return full
    const id = slugifyHeading(text)
    if (/\sid=/.test(attrs)) return full
    return `<h${lvl}${attrs} id="${id}">${inner}</h${lvl}>`
  })
}

/** 标题 -> 锚点 id（中文保留，空白转连字符） */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s\u3000]+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}
