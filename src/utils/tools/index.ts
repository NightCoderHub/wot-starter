/**
 * 通用工具函数
 * 防抖、节流、深拷贝、加密等
 */

/**
 * 防抖
 * @param fn 要执行的函数
 * @param delay 延迟时间（毫秒）
 */
export function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  return function (this: any, ...args: Parameters<T>) {
    if (timer)
      clearTimeout(timer)
    timer = setTimeout(() => {
      fn.apply(this, args)
    }, delay)
  }
}

/**
 * 节流
 * @param fn 要执行的函数
 * @param interval 间隔时间（毫秒）
 */
export function throttle<T extends (...args: any[]) => any>(fn: T, interval: number): (...args: Parameters<T>) => void {
  let lastTime = 0
  return function (this: any, ...args: Parameters<T>) {
    const now = Date.now()
    if (now - lastTime >= interval) {
      lastTime = now
      fn.apply(this, args)
    }
  }
}

/**
 * 深拷贝
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object')
    return obj
  if (obj instanceof Date)
    return new Date(obj.getTime()) as any
  if (Array.isArray(obj))
    return obj.map(item => deepClone(item)) as any
  if (obj instanceof RegExp)
    return new RegExp(obj.source, obj.flags) as any

  const result: any = {}
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = deepClone(obj[key])
    }
  }
  return result
}

/**
 * 生成唯一 ID
 */
export function generateId(prefix = ''): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 9)
}

/**
 * 生成 UUID
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * 简单的 MD5 哈希（非加密级，仅用于简单校验）
 */
export function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(16)
}

/**
 * Base64 编码
 */
export function base64Encode(str: string): string {
  return uni.arrayBufferToBase64(new TextEncoder().encode(str).buffer)
}

/**
 * Base64 解码
 */
export function base64Decode(str: string): string {
  const buffer = uni.base64ToArrayBuffer(str)
  return new TextDecoder().decode(buffer)
}

/**
 * 延迟执行
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 数组去重
 */
export function uniqueArray<T>(arr: T[]): T[] {
  return Array.from(new Set(arr))
}

/**
 * 对象数组按指定字段去重
 */
export function uniqueArrayByKey<T extends Record<string, any>>(arr: T[], key: keyof T): T[] {
  const map = new Map()
  arr.forEach((item) => {
    if (!map.has(item[key])) {
      map.set(item[key], item)
    }
  })
  return Array.from(map.values())
}

/**
 * 随机整数
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * 从数组中随机取一个元素
 */
export function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * 打乱数组（Fisher-Yates 算法）
 */
export function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * 判断是否为空值（null / undefined / 空字符串 / 空数组 / 空对象）
 */
export function isEmpty(value: any): boolean {
  if (value === null || value === undefined)
    return true
  if (typeof value === 'string')
    return value.trim() === ''
  if (Array.isArray(value))
    return value.length === 0
  if (typeof value === 'object')
    return Object.keys(value).length === 0
  return false
}

/**
 * 下载文件
 */
export function downloadFile(url: string, filePath?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    uni.downloadFile({
      url,
      filePath,
      success: res => resolve(res.tempFilePath),
      fail: reject,
    })
  })
}
