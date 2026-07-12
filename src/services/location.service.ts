/**
 * 定位数据服务
 * 负责地理位置数据的「获取、缓存、标准化」
 * 坐标系统一使用 GCJ02（国内主流地图服务标准）
 *
 * 使用方式：
 * const locService = getLocationService()
 * const location = await locService.getCurrentLocation()
 *
 * 注意：本服务不负责权限弹窗，权限问题抛出 LocationError 由调用者处理
 */

import type { LocationOptions, LocationResult, ReverseGeocodeOptions, ReverseGeocodeResult } from './types'
import { LocationError, LocationErrorCode } from './types'

/** 默认配置 */
const DEFAULT_OPTIONS: Required<LocationOptions> = {
  cacheTTL: 5 * 60 * 1000, // 5 分钟
  timeout: 10 * 1000, // 10 秒
  useCache: true,
}

/** 缓存条目 */
interface CacheEntry {
  data: LocationResult
  timestamp: number
}

class LocationService {
  /** 内存缓存 */
  private cache: CacheEntry | null = null

  /** 当前 pending 的定位请求（防重复调用） */
  private pendingRequest: Promise<LocationResult> | null = null

  /**
   * 获取当前位置
   * 优先使用缓存，缓存失效则调用底层 API
   */
  async getCurrentLocation(options?: LocationOptions): Promise<LocationResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options }

    // 检查缓存有效性
    if (opts.useCache && this.isCacheValid(opts.cacheTTL)) {
      return { ...this.cache!.data }
    }

    // 防重复：若已有 pending 请求，复用
    if (this.pendingRequest) {
      return this.pendingRequest
    }

    this.pendingRequest = this.fetchLocation(opts)

    try {
      const result = await this.pendingRequest
      return result
    }
    finally {
      this.pendingRequest = null
    }
  }

  /**
   * 获取最后一次已知位置（可能已过期）
   * 用于定位失败时的兜底
   */
  getLastKnownLocation(): LocationResult | null {
    if (!this.cache)
      return null
    return { ...this.cache.data, stale: true }
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.cache = null
  }

  /**
   * 逆地址解析：将坐标转换为文字地址
   * 使用腾讯位置服务 WebService API
   * @param latitude 纬度（GCJ02 坐标系）
   * @param longitude 经度（GCJ02 坐标系）
   * @param options 解析选项
   */
  async reverseGeocode(
    latitude: number,
    longitude: number,
    options?: ReverseGeocodeOptions,
  ): Promise<ReverseGeocodeResult> {
    const key = import.meta.env.VITE_TENCENT_MAP_KEY as string | undefined
    if (!key) {
      throw new LocationError(
        LocationErrorCode.UNAVAILABLE,
        '腾讯地图 Key 未配置，请在 .env 中设置 VITE_TENCENT_MAP_KEY',
      )
    }

    // 构建请求参数
    const params = new URLSearchParams()
    params.append('key', key)
    params.append('location', `${latitude},${longitude}`)

    if (options?.radius) {
      params.append('radius', String(options.radius))
    }
    if (options?.getPoi) {
      params.append('get_poi', '1')
      const poiOptions: string[] = []
      if (options.poiRadius) {
        poiOptions.push(`radius=${options.poiRadius}`)
      }
      if (options.poiPolicy) {
        poiOptions.push(`policy=${options.poiPolicy}`)
      }
      if (poiOptions.length > 0) {
        params.append('poi_options', poiOptions.join(';'))
      }
    }

    const url = `https://apis.map.qq.com/ws/geocoder/v1/?${params.toString()}`

    try {
      const response = await uni.request({
        url,
        method: 'GET',
        dataType: 'json',
      })

      const data = response.data as {
        status: number
        message: string
        result?: {
          address: string
          formatted_addresses?: { recommend?: string, rough?: string }
          address_component: {
            nation: string
            province: string
            city: string
            district?: string
            street?: string
            street_number?: string
          }
          ad_info: {
            nation_code: string
            adcode: string
            city_code: string
            phone_area_code?: string
            name: string
            location: { lat: number, lng: number }
          }
          pois?: Array<{
            id: string
            title: string
            address?: string
            location: { lat: number, lng: number }
            _distance?: number
            _dir_desc?: string
          }>
        }
      }

      if (data.status !== 0 || !data.result) {
        throw new LocationError(
          LocationErrorCode.UNAVAILABLE,
          `逆地址解析失败: ${data.message || '未知错误'}`,
        )
      }

      const result = data.result
      return {
        address: result.address,
        recommend: result.formatted_addresses?.recommend,
        rough: result.formatted_addresses?.rough,
        addressComponent: {
          nation: result.address_component.nation,
          province: result.address_component.province,
          city: result.address_component.city,
          district: result.address_component.district,
          street: result.address_component.street,
          streetNumber: result.address_component.street_number,
        },
        adInfo: {
          nationCode: result.ad_info.nation_code,
          adcode: result.ad_info.adcode,
          cityCode: result.ad_info.city_code,
          phoneAreaCode: result.ad_info.phone_area_code,
          name: result.ad_info.name,
          location: result.ad_info.location,
        },
        pois: result.pois?.map(poi => ({
          id: poi.id,
          title: poi.title,
          address: poi.address,
          location: poi.location,
          distance: poi._distance,
          dirDesc: poi._dir_desc,
        })),
      }
    }
    catch (error) {
      if (error instanceof LocationError) {
        throw error
      }
      throw new LocationError(
        LocationErrorCode.UNAVAILABLE,
        '逆地址解析请求失败',
        error,
      )
    }
  }

  /**
   * 获取当前位置的文字描述
   * 先获取定位，再进行逆地址解析
   */
  async getCurrentAddress(options?: LocationOptions & ReverseGeocodeOptions): Promise<ReverseGeocodeResult> {
    const location = await this.getCurrentLocation(options)
    return this.reverseGeocode(location.latitude, location.longitude, options)
  }

  /**
   * 清理资源，防止内存泄漏
   * 建议在页面 onUnload 时调用
   */
  destroy() {
    this.cache = null
    this.pendingRequest = null
  }

  // ==================== 私有方法 ====================

  /**
   * 检查缓存是否在有效期内
   */
  private isCacheValid(ttl: number): boolean {
    if (!this.cache)
      return false
    return Date.now() - this.cache.timestamp < ttl
  }

  /**
   * 调用底层 API 获取定位，带超时控制
   */
  private async fetchLocation(opts: Required<LocationOptions>): Promise<LocationResult> {
    try {
      // 超时控制
      const result = await Promise.race([
        this.callLocationAPI(opts),
        this.createTimeout(opts.timeout),
      ])

      // 标准化结果并缓存
      const normalized = this.normalizeResult(result)
      this.cache = {
        data: normalized,
        timestamp: Date.now(),
      }

      return normalized
    }
    catch (error) {
      // 如果是超时错误，直接抛出
      if (error instanceof LocationError) {
        // 尝试返回兜底缓存
        if (this.cache) {
          console.warn('[LocationService] 定位失败，返回过期缓存作为兜底')
          return { ...this.cache.data, stale: true }
        }
        throw error
      }

      // 其他错误：尝试识别错误类型
      const locationError = this.classifyError(error)

      // 权限错误不兜底缓存，直接抛出
      if (locationError.code === LocationErrorCode.PERMISSION_DENIED) {
        throw locationError
      }

      // 其他错误尝试兜底
      if (this.cache) {
        console.warn('[LocationService] 定位失败，返回过期缓存作为兜底')
        return { ...this.cache.data, stale: true }
      }

      throw locationError
    }
  }

  /**
   * 调用平台定位 API（统一使用 GCJ02 坐标系）
   */
  private callLocationAPI(opts: Required<LocationOptions>): Promise<UniNamespace.GetLocationSuccess> {
    return new Promise((resolve, reject) => {
      // #ifdef MP-WEIXIN
      wx.getLocation({
        type: 'gcj02',
        success: resolve,
        fail: (err) => {
          if (err.errMsg?.includes('auth deny') || err.errMsg?.includes('authorize')) {
            reject(new LocationError(
              LocationErrorCode.PERMISSION_DENIED,
              '定位权限被拒绝',
              err,
            ))
          }
          else {
            reject(err)
          }
        },
      })
      // #endif

      // #ifdef MP-ALIPAY
      my.getLocation({
        type: 1, // 1 = GCJ02
        success: (res: any) => resolve(res),
        fail: (err: any) => {
          if (err.error === 11 || err.error === 2001) {
            reject(new LocationError(
              LocationErrorCode.PERMISSION_DENIED,
              '定位权限被拒绝',
              err,
            ))
          }
          else {
            reject(err)
          }
        },
      })
      // #endif

      // #ifdef APP-PLUS
      uni.getLocation({
        type: 'gcj02',
        success: resolve,
        fail: (err) => {
          if (err.errMsg?.includes('auth') || err.errMsg?.includes('permission')) {
            reject(new LocationError(
              LocationErrorCode.PERMISSION_DENIED,
              '定位权限被拒绝',
              err,
            ))
          }
          else {
            reject(err)
          }
        },
      })
      // #endif

      // #ifdef H5
      this.h5TencentLocation(opts, resolve, reject)
      // #endif
    })
  }

  /**
   * 创建超时 Promise
   */
  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new LocationError(LocationErrorCode.TIMEOUT, `定位超时（${ms}ms）`))
      }, ms)
    })
  }

  /**
   * 标准化定位结果
   */
  private normalizeResult(result: UniNamespace.GetLocationSuccess): LocationResult {
    return {
      longitude: result.longitude,
      latitude: result.latitude,
      altitude: result.altitude,
      accuracy: result.accuracy,
      timestamp: Date.now(),
    }
  }

  /**
   * 分类未知错误为 LocationError
   */
  private classifyError(error: unknown): LocationError {
    if (error instanceof LocationError)
      return error

    const errMsg = error instanceof Error ? error.message : String(error)

    if (errMsg.includes('timeout') || errMsg.includes('超时')) {
      return new LocationError(LocationErrorCode.TIMEOUT, '定位超时', error)
    }

    if (errMsg.includes('auth') || errMsg.includes('permission') || errMsg.includes('deny')) {
      return new LocationError(LocationErrorCode.PERMISSION_DENIED, '定位权限被拒绝', error)
    }

    return new LocationError(LocationErrorCode.UNAVAILABLE, '定位服务不可用', error)
  }

  /**
   * H5 端使用腾讯前端定位组件获取位置
   * 脚本已在 index.html 中引入，直接使用 window.LBS
   * 文档: https://lbs.qq.com/webApi/component/componentGuide/componentGeolocation
   */
  private h5TencentLocation(
    opts: Required<LocationOptions>,
    resolve: (value: UniNamespace.GetLocationSuccess) => void,
    reject: (reason: unknown) => void,
  ) {
    const key = import.meta.env.VITE_TENCENT_MAP_KEY as string | undefined
    if (!key) {
      reject(new LocationError(LocationErrorCode.UNAVAILABLE, '腾讯地图 Key 未配置，请在 .env 中设置 VITE_TENCENT_MAP_KEY'))
      return
    }

    const LBS = (window as any).LBS
    if (!LBS?.WebComponent?.Geolocation) {
      reject(new LocationError(LocationErrorCode.UNAVAILABLE, '腾讯定位组件未加载，请检查 index.html 是否引入定位脚本'))
      return
    }

    const geo = new LBS.WebComponent.Geolocation({
      key,
      referer: 'wot-starter',
    })

    geo.getLocation(
      (result: any) => {
        resolve({
          longitude: result.lng,
          latitude: result.lat,
          accuracy: result.accuracy,
        } as UniNamespace.GetLocationSuccess)
      },
      (error: any) => {
        const status = error?.status
        // 10101: 权限拒绝
        if (status === 10101) {
          reject(new LocationError(LocationErrorCode.PERMISSION_DENIED, '定位权限被拒绝', error))
        }
        // 10103: 超时
        else if (status === 10103) {
          reject(new LocationError(LocationErrorCode.TIMEOUT, '定位超时', error))
        }
        // 其他失败
        else {
          reject(new LocationError(LocationErrorCode.UNAVAILABLE, error?.message || '定位失败', error))
        }
      },
      {
        timeout: opts.timeout,
        highAccuracy: true,
      },
    )
  }
}

/** 单例实例 */
let instance: LocationService | null = null

/**
 * 获取定位服务单例
 */
export function getLocationService(): LocationService {
  if (!instance) {
    instance = new LocationService()
  }
  return instance
}
