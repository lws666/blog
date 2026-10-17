/**
 * 导入历史评论到 Twikoo（D1）。
 *
 * 数据来源：giscus / GitHub Discussions（通过 GraphQL 导出）。
 * Twikoo comment 表关键字段：
 *   url     = 文章 slug（纯 slug，不含 /blog/ 前缀——与 Twikoo 前端的
 *             path 传参一致，TocComment 组件传的是 data.post.slug）
 *   comment = HTML（<p> 包裹）
 *   created = 毫秒时间戳
 *   master  = 1 表示站长（老版样式有主人标记）
 *   avatar  = 直接给头像 URL（否则 Twikoo 用 mailMd5 走 Gravatar）
 *
 * 用法：node scripts/import-comments.mjs
 * （当前清单硬编码在 IMPORTS；来源少就这样最直观）
 */
import { createHash } from 'node:crypto'

const TOKEN = process.env.CLOUDFLARE_API_TOKEN || (() => {
  console.error('请设置 CLOUDFLARE_API_TOKEN')
  process.exit(1)
})()
const ACC = '17ce86a3f57298f75288a527ba0119b6'
const DB = 'd894eec2-4dc8-473a-92ca-efe3c13261de'

/** 从 giscus 导出的评论清单 */
const IMPORTS = [
  {
    nick: 'lws666',
    mail: '13318678430@163.com',
    avatar: 'https://avatars.githubusercontent.com/u/172916248?v=4',
    comment: 'Hello Word',
    url: '2026-07-26-',
    href: 'https://www.lwsnb.eu.cc/posts/2026-07-26-',
    created: '2026-08-24T15:30:39Z',
    master: 1,
  },
]

async function d1(sql, params = []) {
  const body = JSON.stringify({ sql, params }).replace(/\\"/g, '\\"')
  const req = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACC}/d1/database/${DB}/query`,
    { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body },
  )
  const j = await req.json()
  if (!j.success) throw new Error(JSON.stringify(j.errors))
  return j.result[0].results
}

let ok = 0
for (const c of IMPORTS) {
  const _id = createHash('md5').update(c.mail + c.comment + c.created).digest('hex')
  const created = new Date(c.created).getTime()
  const mailMd5 = createHash('md5').update(c.mail).digest('hex')
  await d1(
    `INSERT INTO comment
       (_id, uid, nick, mail, mailMd5, link, avatar, ua, ip, ipRegion,
        master, url, href, comment, pid, rid, "like", top, isSpam,
        created, updated, extra)
     VALUES (?, '', ?, ?, ?, '', ?, 'GitHub Discussions 导入', '', '',
             ?, ?, ?, ?, '', '', '[]', 0, 0, ?, ?, '{}')`,
    [_id, c.nick, c.mail, mailMd5, c.avatar ?? '',
     c.master ?? 0, c.url, c.href, `<p>${c.comment}</p>`, created, created],
  )
  ok++
  console.log(`  ✓ ${c.nick}: ${c.comment.slice(0, 30)}`)
}

const rows = await d1('SELECT nick, url FROM comment')
console.log(`\n完成 ${ok} 条导入；comment 表现有 ${rows.length} 条`)
