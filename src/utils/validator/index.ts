/**
 * 数据校验工具
 * 手机号、身份证、邮箱、正则等常用校验
 */

/**
 * 校验手机号（中国大陆）
 */
export function validatePhone(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone)
}

/**
 * 校验身份证号（18位）
 */
export function validateIdCard(idCard: string): boolean {
  const reg = /^[1-9]\d{5}(?:18|19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dX]$/i
  if (!reg.test(idCard))
    return false

  // 校验码验证
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
  const checkCodes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']
  let sum = 0
  for (let i = 0; i < 17; i++) {
    sum += Number.parseInt(idCard[i]) * weights[i]
  }
  const checkCode = checkCodes[sum % 11]
  return idCard[17].toUpperCase() === checkCode
}

/**
 * 校验邮箱
 */
export function validateEmail(email: string): boolean {
  return /^[\w-]+(?:\.[\w-]+)*@[\w-]+(?:\.[\w-]+)+$/.test(email)
}

/**
 * 校验车牌号
 */
export function validatePlateNumber(plate: string): boolean {
  // 普通燃油车 + 新能源车
  const reg = /^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领][A-HJ-NP-Z][A-HJ-NP-Z0-9]{4,5}[A-HJ-NP-Z0-9挂学警港澳]$/
  return reg.test(plate)
}

/**
 * 校验银行卡号（Luhn 算法）
 */
export function validateBankCard(cardNo: string): boolean {
  if (!/^\d{16,19}$/.test(cardNo))
    return false

  let sum = 0
  const digits = cardNo.split('').reverse()
  for (let i = 0; i < digits.length; i++) {
    let num = Number.parseInt(digits[i])
    if (i % 2 === 1) {
      num *= 2
      if (num > 9)
        num -= 9
    }
    sum += num
  }
  return sum % 10 === 0
}

/**
 * 校验是否为纯数字
 */
export function validateNumber(str: string): boolean {
  return /^\d+$/.test(str)
}

/**
 * 校验是否为正整数
 */
export function validatePositiveInt(num: number | string): boolean {
  return /^[1-9]\d*$/.test(String(num))
}

/**
 * 校验是否为金额（最多两位小数）
 */
export function validateAmount(amount: number | string): boolean {
  return /^(?:[1-9]\d*|0)(?:\.\d{1,2})?$/.test(String(amount))
}

/**
 * 校验密码强度
 * 至少 8 位，包含字母和数字
 */
export function validatePassword(password: string): boolean {
  return /^(?=.*[A-Z])(?=.*\d).{8,}$/i.test(password)
}

/**
 * 校验 URL
 */
export function validateUrl(url: string): boolean {
  return /^(?:https?:\/\/)?[\da-z.-]+\.[a-z]+(?:\/\S*)?$/.test(url)
}

/**
 * 校验中文姓名（2-10个汉字）
 */
export function validateChineseName(name: string): boolean {
  return /^[\u4E00-\u9FA5]{2,10}$/.test(name)
}

/**
 * 校验邮政编码
 */
export function validatePostalCode(code: string): boolean {
  return /^\d{6}$/.test(code)
}
