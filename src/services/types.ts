/**
 * 定位体系共享类型定义
 * PermissionService 与 LocationService 的公共类型
 */

// ==================== 权限相关 ====================

/** 权限状态三段 */
export type PermissionStatus = 'granted' | 'denied' | 'unasked'

/** 支持的权限类型 */
export type PermissionScope = 'location' | 'camera' | 'album' | 'userInfo'

// ==================== 定位相关 ====================

/** 统一定位结果（对外输出格式） */
export interface LocationResult {
  /** 经度 */
  longitude: number
  /** 纬度 */
  latitude: number
  /** 海拔（米） */
  altitude?: number
  /** 精度（米） */
  accuracy?: number
  /** 获取时间戳 */
  timestamp: number
  /** 是否为过期缓存数据 */
  stale?: boolean
}

/** 定位选项 */
export interface LocationOptions {
  /** 缓存有效期(ms)，默认 300000 (5分钟) */
  cacheTTL?: number
  /** 超时时间(ms)，默认 10000 */
  timeout?: number
  /** 是否使用缓存，默认 true */
  useCache?: boolean
}

// ==================== 错误处理 ====================

/** 定位错误码 */
export enum LocationErrorCode {
  /** 用户拒绝授权 */
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  /** 定位超时 */
  TIMEOUT = 'TIMEOUT',
  /** 定位服务不可用 */
  UNAVAILABLE = 'UNAVAILABLE',
  /** 用户取消操作 */
  CANCELLED = 'CANCELLED',
}

/**
 * 定位错误上下文
 * 含原始错误信息，便于 UI 层按 code 展示不同提示
 */
export class LocationError extends Error {
  readonly code: LocationErrorCode
  readonly originalError?: unknown

  constructor(code: LocationErrorCode, message: string, originalError?: unknown) {
    super(message)
    this.name = 'LocationError'
    this.code = code
    this.originalError = originalError
  }
}

// ==================== 逆地址解析相关 ====================

/** 逆地址解析选项 */
export interface ReverseGeocodeOptions {
  /** 吸附半径（米），默认 0，最大 5000 */
  radius?: number
  /** 是否返回周边 POI 列表，默认 false */
  getPoi?: boolean
  /** POI 半径（米），1-5000 */
  poiRadius?: number
  /** POI 返回策略 1-5 */
  poiPolicy?: 1 | 2 | 3 | 4 | 5
}

/** 逆地址解析结果 */
export interface ReverseGeocodeResult {
  /** 标准格式化地址（行政区划+道路+门牌号） */
  address: string
  /** 推荐使用的地址描述（更人性化） */
  recommend?: string
  /** 粗略位置描述 */
  rough?: string
  /** 地址部件 */
  addressComponent: {
    /** 国家 */
    nation: string
    /** 省 */
    province: string
    /** 市 */
    city: string
    /** 区 */
    district?: string
    /** 道路 */
    street?: string
    /** 门牌 */
    streetNumber?: string
  }
  /** 行政区划信息 */
  adInfo: {
    /** 国家代码（ISO3126标准 3 位数字码） */
    nationCode: string
    /** 行政区划代码 */
    adcode: string
    /** 城市代码（9位） */
    cityCode: string
    /** 电话区号 */
    phoneAreaCode?: string
    /** 行政区划名称 */
    name: string
    /** 行政区划中心点坐标 */
    location: { lat: number, lng: number }
  }
  /** 周边 POI 列表（仅当 getPoi=true 时返回） */
  pois?: Array<{
    /** POI 唯一标识 */
    id: string
    /** 名称 */
    title: string
    /** 地址 */
    address?: string
    /** 坐标 */
    location: { lat: number, lng: number }
    /** 距离（米） */
    distance?: number
    /** 方位描述 */
    dirDesc?: string
  }>
}
