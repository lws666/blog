/**
 * 音乐数据层：解析 Meting API 返回的音频地址，并探测可播性。
 *
 * 背景（实测）：
 *  - 本 Meting 实例（v1.1.2 / Cloudflare）返回的 url 形如
 *    https://music.lwsnb.eu.cc/api?server=netease&type=url&id=<id>
 *    该地址会 302 到网易云外链；**部分歌曲因版权/VIP 会落到 /404（HTML）**，
 *    这类歌播放器必然无声。
 *  - 腾讯源返回 @qq_get_url_from_json@ 占位符，需客户端二次解析 vkey；
 *    实测多数 purl 为空（result 104003），同样不可播。
 *
 * 因此这里在加载歌单后**逐首探测**（HEAD/GET 看 content-type），
 * 只把真正返回音频的曲目交给播放器，并在 UI 上说明跳过了几首。
 */

export interface RawSong {
  title: string
  author: string
  pic: string
  url: string
  lrc?: string
}

export interface PlayableSong extends RawSong {
  /** 直链是否确认为音频流 */
  playable: boolean
}

/**
 * 探测单个地址是否为可播放音频。
 * 用 GET + Range 只取头部（避免下载整首），看 content-type。
 */
async function probe(url: string, timeoutMs = 6000): Promise<boolean> {
  if (!url || url.includes('@')) return false // 未解析的占位符
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-1' },
      signal: ctl.signal,
      redirect: 'follow',
    })
    const ct = res.headers.get('content-type') || ''
    // 读掉极小响应体，避免连接挂起
    try { await res.arrayBuffer() } catch { /* ignore */ }
    return res.ok && /audio|mpeg|octet-stream|mp4/i.test(ct)
  } catch {
    return false
  } finally {
    clearTimeout(t)
  }
}

/**
 * 并发探测（限制并发数，避免一次打满连接）。
 * 返回带 playable 标记的完整列表（保留顺序）。
 */
export async function probeAll(
  list: RawSong[],
  concurrency = 4,
): Promise<{ songs: PlayableSong[], playableCount: number }> {
  const out: PlayableSong[] = list.map(s => ({ ...s, playable: false }))
  let i = 0

  async function worker() {
    while (i < out.length) {
      const idx = i++
      out[idx].playable = await probe(out[idx].url)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, out.length) }, worker))
  return { songs: out, playableCount: out.filter(s => s.playable).length }
}
