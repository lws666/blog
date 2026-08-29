import { Hono } from 'hono'
import type { Env } from '../index'

/**
 * Telegram notification API for blog comments.
 *
 * POST /api/tg/webhook — GitHub repo webhook receiver (giscus comments).
 *   GitHub sends `discussion_comment.created` / `discussion.created` events
 *   from the lws666/blog repo; each new comment is pushed to the owner's
 *   Telegram chat with the commenter's name, avatar and the comment body.
 *
 * The route is mounted OUTSIDE the Bearer middleware: access control here is
 * the HMAC signature check (X-Hub-Signature-256) against TG_WEBHOOK_SECRET,
 * which only GitHub and this worker know.
 */

/** HTML-escape user-controlled content (Telegram parse_mode=HTML). */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Trim markdown to a readable one-line-ish excerpt for a chat message. */
function excerpt(body: string, max = 400): string {
  return body.length > max ? `${body.slice(0, max)}…` : body
}

export function createTelegramRouter() {
  const router = new Hono<{ Bindings: Env }>()

  // ── POST /webhook — GitHub webhook → Telegram push ────────────
  router.post('/webhook', async (c) => {
    const raw = await c.req.text()

    // 1. Verify the HMAC-SHA256 signature so nobody can spoof comments
    const secret = c.env.TG_WEBHOOK_SECRET
    const sig = c.req.header('X-Hub-Signature-256') || ''
    if (secret) {
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      )
      const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw))
      const hex = [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, '0')).join('')
      if (sig !== `sha256=${hex}`) {
        return c.json({ success: false, error: 'invalid signature' }, 401)
      }
    }

    // 2. Parse the event
    const event = c.req.header('X-GitHub-Event') || ''
    let payload: any
    try {
      payload = JSON.parse(raw)
    } catch {
      return c.json({ success: false, error: 'invalid json' }, 400)
    }

    // New comment on an existing discussion, or the first comment on a
    // post (giscus creates a discussion together with it).
    let login = ''
    let avatar = ''
    let title = ''
    let body = ''
    let url = ''

    if (event === 'discussion_comment' && payload.action === 'created') {
      login = payload.sender?.login || ''
      avatar = payload.sender?.avatar_url || ''
      title = payload.discussion?.title || ''
      body = payload.comment?.body || ''
      url = payload.comment?.html_url || payload.discussion?.html_url || ''
    } else if (event === 'discussion' && payload.action === 'created') {
      // discussion.author is the commenter for giscus-created discussions;
      // fall back to the event sender
      const author = payload.discussion?.author || payload.sender || {}
      login = author.login || ''
      avatar = author.avatar_url || ''
      title = payload.discussion?.title || ''
      body = payload.discussion?.body || ''
      url = payload.discussion?.html_url || ''
    } else {
      // reactions / edits / deletes etc. — nothing to push
      return c.json({ success: true, skipped: true })
    }

    if (!login || !body) return c.json({ success: true, skipped: true })

    // 3. Build the message (caption limit is 1024 chars)
    //    Post title from the giscus discussion title ("posts/xxx")
    const postTitle = title.startsWith('posts/')
      ? title.slice(title.indexOf('/') + 1)
      : title
    const lines = [
      '💬 <b>博客新评论</b>',
      '',
      `👤 <a href="https://github.com/${encodeURIComponent(login)}">${esc(login)}</a>`,
      postTitle ? `📄 ${esc(postTitle)}` : '',
      '',
      excerpt(body),
      '',
      url ? `🔗 <a href="${esc(url)}">查看 / 回复</a>` : '',
    ].filter(l => l !== '' || true)
    const text = lines.filter((l, i) => !(l === '' && lines[i - 1] === '')).join('\n').slice(0, 1000)

    // 4. Push to Telegram: avatar as photo + caption, plain text fallback
    const ok = await sendTelegram(c.env, text, avatar)
    if (!ok) return c.json({ success: false, error: 'telegram send failed' }, 502)
    return c.json({ success: true })
  })

  return router
}

/** Send via the Bot API: sendPhoto (avatar) with caption, fallback sendMessage. */
async function sendTelegram(env: Env, text: string, photoUrl?: string): Promise<boolean> {
  const token = env.TELEGRAM_BOT_TOKEN
  const chatId = env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return false

  const api = `https://api.telegram.org/bot${token}`

  if (photoUrl) {
    try {
      const res = await fetch(`${api}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          photo: photoUrl,
          caption: text,
          parse_mode: 'HTML',
        }),
      })
      if (res.ok) return true
    } catch {
      // fall through to sendMessage
    }
  }

  try {
    const res = await fetch(`${api}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      }),
    })
    return res.ok
  } catch {
    return false
  }
}
