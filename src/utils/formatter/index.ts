/**
 * 格式化工具
 * 时间、金额、字符串处理等
 */

/**
 * 格式化时间
 * @param timestamp 时间戳或 Date 对象
 * @param format 格式化字符串，默认 YYYY-MM-DD HH:mm:ss
 */
export function formatTime(timestamp: number | Date, format = 'YYYY-MM-DD HH:mm:ss'): string {
  const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  const second = String(date.getSeconds()).padStart(2, '0')

  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hour)
    .replace('mm', minute)
    .replace('ss', second)
}

/**
 * 格式化相对时间（几分钟前、几小时前等）
 */
export function formatRelativeTime(timestamp: number | Date): string {
  const time = typeof timestamp === 'number' ? timestamp : timestamp.getTime()
  const diff = Date.now() - time

  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  const month = 30 * day
  const year = 365 * day

  if (diff < minute)
    return '刚刚'
  if (diff < hour)
    return `${Math.floor(diff / minute)}分钟前`
  if (diff < day)
    return `${Math.floor(diff / hour)}小时前`
  if (diff < month)
    return `${Math.floor(diff / day)}天前`
  if (diff < year)
    return `${Math.floor(diff / month)}个月前`
  return `${Math.floor(diff / year)}年前`
}

/**
 * 格式化金额（保留两位小数，千分位分隔）
 */
export function formatMoney(amount: number | string, decimals = 2): string {
  const num = Number(amount) || 0
  return num.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/**
 * 格式化金额为中文大写
 */
export function formatMoneyChinese(amount: number): string {
  const digits = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖']
  const units = ['', '拾', '佰', '仟', '万', '拾', '佰', '仟', '亿']

  if (amount === 0)
    return '零元整'

  const intPart = Math.floor(amount)
  const decPart = Math.round((amount - intPart) * 100)

  let result = ''
  const intStr = String(intPart)
  for (let i = 0; i < intStr.length; i++) {
    const digit = Number.parseInt(intStr[i])
    const unitIndex = intStr.length - 1 - i
    if (digit !== 0) {
      result += digits[digit] + units[unitIndex]
    }
    else if (result && !result.endsWith('零') && unitIndex !== 4 && unitIndex !== 8) {
      result += '零'
    }
    if (unitIndex === 4 || unitIndex === 8) {
      if (result.endsWith('零')) {
        result = result.slice(0, -1)
      }
      if (!result.endsWith(units[unitIndex])) {
        result += units[unitIndex]
      }
    }
  }
  if (result.endsWith('零')) {
    result = result.slice(0, -1)
  }
  result += '元'

  if (decPart === 0) {
    result += '整'
  }
  else {
    const jiao = Math.floor(decPart / 10)
    const fen = decPart % 10
    if (jiao > 0)
      result += `${digits[jiao]}角`
    if (fen > 0)
      result += `${digits[fen]}分`
  }

  return result
}

/**
 * 手机号脱敏（中间四位替换为 *）
 */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 11)
    return phone
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}

/**
 * 身份证号脱敏
 */
export function maskIdCard(idCard: string): string {
  if (!idCard || idCard.length < 15)
    return idCard
  return idCard.replace(/(\d{6})\d+(\d{4})/, '$1********$2')
}

/**
 * 姓名脱敏（只保留第一个字）
 */
export function maskName(name: string): string {
  if (!name)
    return name
  if (name.length === 1)
    return name
  if (name.length === 2)
    return `${name[0]}*`
  return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1]
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0)
    return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / k ** i).toFixed(2)} ${sizes[i]}`
}

/**
 * 去除字符串首尾空格
 */
export function trim(str: string): string {
  return str.replace(/^\s+|\s+$/g, '')
}

/**
 * 首字母大写
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * 字符串截断加省略号
 */
export function truncate(str: string, maxLength: number, suffix = '...'): string {
  if (str.length <= maxLength)
    return str
  return str.slice(0, maxLength) + suffix
}
