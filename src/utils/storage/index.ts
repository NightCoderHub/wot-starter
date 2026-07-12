/**
 * 本地存储管理
 * 封装 uni.setStorage 等 API，统一异常处理
 */

/** 存储前缀，避免命名冲突 */
const PREFIX = 'app_'

/**
 * 设置本地存储（同步）
 */
export function setStorageSync(key: string, value: any): void {
  try {
    uni.setStorageSync(PREFIX + key, JSON.stringify(value))
  }
  catch (e) {
    console.error('[storage] setStorageSync error:', e)
  }
}

/**
 * 获取本地存储（同步）
 */
export function getStorageSync<T = any>(key: string, defaultValue?: T): T | undefined {
  try {
    const data = uni.getStorageSync(PREFIX + key)
    if (data === '' || data === null || data === undefined) {
      return defaultValue
    }
    return JSON.parse(data) as T
  }
  catch (e) {
    console.error('[storage] getStorageSync error:', e)
    return defaultValue
  }
}

/**
 * 删除本地存储（同步）
 */
export function removeStorageSync(key: string): void {
  try {
    uni.removeStorageSync(PREFIX + key)
  }
  catch (e) {
    console.error('[storage] removeStorageSync error:', e)
  }
}

/**
 * 清空所有本地存储（同步）
 */
export function clearStorageSync(): void {
  try {
    uni.clearStorageSync()
  }
  catch (e) {
    console.error('[storage] clearStorageSync error:', e)
  }
}

/**
 * 设置带过期时间的存储
 * @param key 键名
 * @param value 值
 * @param expire 过期时间（毫秒）
 */
export function setStorageWithExpire(key: string, value: any, expire: number): void {
  const data = {
    value,
    expire: Date.now() + expire,
  }
  setStorageSync(key, data)
}

/**
 * 获取带过期时间的存储
 */
export function getStorageWithExpire<T = any>(key: string, defaultValue?: T): T | undefined {
  const data = getStorageSync<{ value: T, expire: number }>(key)
  if (!data)
    return defaultValue

  if (Date.now() > data.expire) {
    removeStorageSync(key)
    return defaultValue
  }
  return data.value
}

/**
 * 获取存储信息
 */
export function getStorageInfoSync() {
  return uni.getStorageInfoSync()
}
