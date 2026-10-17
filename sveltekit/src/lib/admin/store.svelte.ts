/**
 * 管理后台全局状态：登录态 + 当前用户。
 * 用 Svelte 5 runes 的 class 形式，跨组件共享。
 */
import { getToken, clearToken, me as fetchMe } from './api'

class AdminAuth {
  /** 是否已登录（有 token 且校验通过） */
  ready = $state(false)
  checking = $state(true)
  username = $state('')
  role = $state('')

  get isAdmin(): boolean {
    return this.role === 'admin'
  }

  /** 进入后台时校验现有 token */
  async init(): Promise<void> {
    this.checking = true
    try {
      if (!getToken()) {
        this.ready = false
        return
      }
      const u = await fetchMe()
      this.username = u.username
      this.role = u.role
      this.ready = true
    } catch {
      clearToken()
      this.ready = false
    } finally {
      this.checking = false
    }
  }

  setUser(username: string, role: string): void {
    this.username = username
    this.role = role
    this.ready = true
    this.checking = false
  }

  reset(): void {
    this.username = ''
    this.role = ''
    this.ready = false
    clearToken()
  }
}

export const adminAuth = new AdminAuth()
