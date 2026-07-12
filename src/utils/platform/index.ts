/**
 * 平台兼容工具
 * 封装各端 API 差异，统一调用方式
 */

/** 平台类型 */
export type PlatformType = 'mp-weixin' | 'mp-alipay' | 'mp-baidu' | 'mp-toutiao' | 'mp-qq' | 'h5' | 'app' | 'app-plus'

/**
 * 获取当前平台
 */
export function getPlatform(): PlatformType {
  // #ifdef MP-WEIXIN
  return 'mp-weixin'
  // #endif
  // #ifdef MP-ALIPAY
  return 'mp-alipay'
  // #endif
  // #ifdef MP-BAIDU
  return 'mp-baidu'
  // #endif
  // #ifdef MP-TOUTIAO
  return 'mp-toutiao'
  // #endif
  // #ifdef MP-QQ
  return 'mp-qq'
  // #endif
  // #ifdef H5
  return 'h5'
  // #endif
  // #ifdef APP-PLUS
  return 'app-plus'
  // #endif
  // #ifdef APP
  return 'app'
  // #endif
}

/**
 * 是否为微信小程序
 */
export function isWeixin(): boolean {
  return getPlatform() === 'mp-weixin'
}

/**
 * 是否为 H5
 */
export function isH5(): boolean {
  return getPlatform() === 'h5'
}

/**
 * 是否为 App
 */
export function isApp(): boolean {
  const p = getPlatform()
  return p === 'app' || p === 'app-plus'
}

/**
 * 统一获取系统信息
 */
export function getSystemInfo() {
  return uni.getSystemInfoSync()
}

/**
 * 获取状态栏高度（适配刘海屏）
 */
export function getStatusBarHeight(): number {
  const sysInfo = getSystemInfo()
  return sysInfo.statusBarHeight || 20
}

/**
 * 获取导航栏高度（包含状态栏）
 */
export function getNavBarHeight(): number {
  const sysInfo = getSystemInfo()
  const statusBarHeight = sysInfo.statusBarHeight || 20

  // #ifdef MP-WEIXIN
  const menuButton = uni.getMenuButtonBoundingClientRect()
  return menuButton.bottom + menuButton.top - statusBarHeight + statusBarHeight
  // #endif

  // 默认导航栏高度 44px + 状态栏
  return statusBarHeight + 44
}

/**
 * 统一设置剪贴板
 */
export function setClipboardData(data: string): Promise<void> {
  return new Promise((resolve, reject) => {
    uni.setClipboardData({
      data,
      success: () => resolve(),
      fail: reject,
    })
  })
}

/**
 * 统一获取剪贴板
 */
export function getClipboardData(): Promise<string> {
  return new Promise((resolve, reject) => {
    uni.getClipboardData({
      success: res => resolve(res.data),
      fail: reject,
    })
  })
}
