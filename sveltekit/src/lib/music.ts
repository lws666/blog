/**
 * 音乐数据层。
 *
 * ⚠ 重要（曾经的错误做法）：
 * 早期用 `fetch(url, {Range})` 探测 content-type 来判断可播性。但
 * fetch 受 **CORS** 约束——音频服务器（music.163.com）不返回
 * Access-Control-Allow-Origin，fetch 必然抛错/被 ORB 拦截，
 * 于是**大量本来能播的曲目被误判为不可播**并过滤掉。
 *
 * 而 <audio>/APlayer 加载音频走的是 no-cors 媒体加载，**不受 CORS 限制**，
 * 能否播放只取决于服务器是否真的返回音频流（与 IP/版权/登录态有关）。
 *
 * 因此这里**不再做 fetch 探测**，直接把完整歌单交给 APlayer；
 * 若某首确实加载失败，APlayer 会触发 error 事件，由 UI 提示并可跳过。
 */

export interface RawSong {
  title: string
  author: string
  pic: string
  url: string
  lrc?: string
}

/** 过滤明显无效的条目（空 url / 未解析占位符），其余全部保留 */
export function sanitizeSongs(list: RawSong[]): RawSong[] {
  if (!Array.isArray(list)) return []
  return list.filter(
    s => s && typeof s.url === 'string' && s.url.length > 0 && !s.url.includes('@'),
  )
}
