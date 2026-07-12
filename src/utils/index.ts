/**
 * 工具函数统一出口
 */

// 格式化工具
export * from './formatter'

// 平台兼容
export * from './platform'

// 存储管理
export * from './storage'

// 通用工具
export * from './tools'

// 数据校验
export * from './validator'

/**
 * 获取当前页面路径
 * @returns 当前页面路径
 */
export function getCurrentPath() {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  return currentPage.route || ''
}
