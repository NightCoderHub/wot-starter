/**
 * 权限守卫服务
 * 负责权限的「状态检查、申请发起、失败引导」
 *
 * 使用方式：
 * const permService = getPermissionService()
 * const status = await permService.checkPermission('location')
 */

import type { PermissionScope, PermissionStatus } from './types'

/** 各平台权限 Scope 映射 */
const WEIXIN_SCOPE_MAP: Record<PermissionScope, string> = {
  location: 'scope.userLocation',
  camera: 'scope.camera',
  album: 'scope.writePhotosAlbum',
  userInfo: 'scope.userInfo',
}

const ALIPAY_SCOPE_MAP: Record<PermissionScope, string> = {
  location: 'location',
  camera: 'camera',
  album: 'album',
  userInfo: 'userInfo',
}

/** 权限拒绝埋点回调（预留接口） */
type DenyTracker = (scope: PermissionScope, platform: string) => void

class PermissionService {
  /** 三段式状态缓存 */
  private statusMap = new Map<PermissionScope, PermissionStatus>()

  /** 幂等防抖：同一 scope 的 pending Promise */
  private pendingRequests = new Map<PermissionScope, Promise<PermissionStatus>>()

  /** 埋点回调 */
  private denyTracker: DenyTracker | null = null

  /**
   * 注册埋点回调
   * @param tracker 拒绝授权时的回调函数
   */
  setDenyTracker(tracker: DenyTracker) {
    this.denyTracker = tracker
  }

  /**
   * 检查权限状态（不触发弹窗）
   * 若状态为 unasked，会尝试静默查询当前授权状态
   */
  async checkPermission(scope: PermissionScope): Promise<PermissionStatus> {
    const cached = this.statusMap.get(scope)
    if (cached && cached !== 'unasked') {
      // #ifdef H5
      // H5 端：用户可能在浏览器设置中手动开启了权限
      // 即使缓存为 denied，也要重新探测实际状态
      if (cached === 'denied') {
        const realStatus = await this.h5RecheckPermission(scope)
        if (realStatus !== 'denied') {
          this.statusMap.set(scope, realStatus)
          return realStatus
        }
        return 'denied'
      }
      // #endif
      return cached
    }

    // 尝试查询当前系统授权状态
    const systemStatus = await this.querySystemStatus(scope)
    this.statusMap.set(scope, systemStatus)
    return systemStatus
  }

  /**
   * 请求权限（可能触发系统弹窗）
   * 幂等防抖：同一 scope 并发调用返回同一 Promise
   */
  async requestPermission(scope: PermissionScope): Promise<PermissionStatus> {
    // 已授权直接返回
    if (this.statusMap.get(scope) === 'granted') {
      return 'granted'
    }

    // #ifdef H5
    // H5 端：缓存为 denied 时不直接拦截，先重新探测
    // 用户可能已在浏览器设置中手动开启权限
    if (this.statusMap.get(scope) === 'denied') {
      const realStatus = await this.h5RecheckPermission(scope)
      if (realStatus === 'granted') {
        this.statusMap.set(scope, 'granted')
        return 'granted'
      }
      // 仍然是 denied，继续走后续流程（引导用户去设置）
    }
    // #endif

    // 幂等防抖：若已有 pending 请求，复用
    const pending = this.pendingRequests.get(scope)
    if (pending) {
      return pending
    }

    const promise = this.doRequestPermission(scope)
    this.pendingRequests.set(scope, promise)

    try {
      const status = await promise
      return status
    }
    finally {
      this.pendingRequests.delete(scope)
    }
  }

  /**
   * 引导用户去设置页开启权限
   * @returns 是否成功开启
   */
  async openSetting(): Promise<boolean> {
    return new Promise((resolve) => {
      // #ifdef MP-WEIXIN
      wx.openSetting({
        success: (res) => {
          // 刷新状态缓存
          this.statusMap.clear()
          resolve(!!res.authSetting['scope.userLocation'])
        },
        fail: () => resolve(false),
      })
      // #endif

      // #ifdef MP-ALIPAY
      my.openSetting({
        success: (res: any) => {
          this.statusMap.clear()
          resolve(!!res.authSetting.location)
        },
        fail: () => resolve(false),
      })
      // #endif

      // #ifdef APP-PLUS
      // App 端跳转应用权限设置页
      this.gotoAppPermissionSetting(resolve)
      // #endif

      // #ifdef H5
      // H5 端无法通过代码打开浏览器设置页，引导用户手动操作
      this.guideH5UserToSettings(resolve)
      // #endif
    })
  }

  /**
   * 权限拒绝时的统一引导弹窗
   * 由 LocationService 或业务页面调用
   */
  async guideUserToSetting(scope: PermissionScope, message = '需要您开启权限才能使用此功能'): Promise<boolean> {
    const dialog = useGlobalDialog()
    return new Promise((resolve) => {
      // 使用 success 回调处理用户点击
      dialog.confirm({
        title: '权限申请',
        msg: message,
        confirmButtonText: '去设置',
        cancelButtonText: '取消',
        success: async (res) => {
          if (res.action === 'confirm') {
            const result = await this.openSetting()
            resolve(result)
          }
          else {
            resolve(false)
          }
        },
      })
    })
  }

  /**
   * 清理资源，防止内存泄漏
   * 建议在页面 onUnload 时调用
   */
  destroy() {
    this.statusMap.clear()
    this.pendingRequests.clear()
    this.denyTracker = null
  }

  // ==================== 私有方法 ====================

  /**
   * 查询系统当前授权状态（不触发弹窗）
   */
  private async querySystemStatus(scope: PermissionScope): Promise<PermissionStatus> {
    return new Promise((resolve) => {
      // #ifdef MP-WEIXIN
      wx.getSetting({
        success: (res) => {
          const wxScope = WEIXIN_SCOPE_MAP[scope]
          const authSetting = res.authSetting as Record<string, boolean | undefined>
          const authVal = authSetting[wxScope]
          if (authVal === true)
            resolve('granted')
          else if (authVal === false)
            resolve('denied')
          else
            resolve('unasked')
        },
        fail: () => resolve('unasked'),
      })
      // #endif

      // #ifdef MP-ALIPAY
      my.getSetting({
        success: (res: any) => {
          const alipayScope = ALIPAY_SCOPE_MAP[scope]
          const authVal = res.authSetting?.[alipayScope]
          if (authVal === true)
            resolve('granted')
          else if (authVal === false)
            resolve('denied')
          else
            resolve('unasked')
        },
        fail: () => resolve('unasked'),
      })
      // #endif

      // #ifdef APP-PLUS
      // App 端通过 plus 原生 API 查询权限状态
      this.queryAppPermissionStatus(scope, resolve)
      // #endif

      // #ifdef H5
      // H5 端优先使用 Permissions API 静默查询，不支持则返回 unasked
      this.queryH5PermissionStatus(scope, resolve)
      // #endif
    })
  }

  /**
   * 实际发起权限请求
   */
  private async doRequestPermission(scope: PermissionScope): Promise<PermissionStatus> {
    return new Promise((resolve) => {
      // #ifdef MP-WEIXIN
      wx.authorize({
        scope: WEIXIN_SCOPE_MAP[scope],
        success: () => {
          this.statusMap.set(scope, 'granted')
          resolve('granted')
        },
        fail: () => {
          this.statusMap.set(scope, 'denied')
          this.recordDeny(scope)
          resolve('denied')
        },
      })
      // #endif

      // #ifdef MP-ALIPAY
      my.getAuthCode({
        scopes: ALIPAY_SCOPE_MAP[scope],
        success: () => {
          this.statusMap.set(scope, 'granted')
          resolve('granted')
        },
        fail: () => {
          this.statusMap.set(scope, 'denied')
          this.recordDeny(scope)
          resolve('denied')
        },
      })
      // #endif

      // #ifdef APP-PLUS
      // App 端不支持 uni.authorize，需通过 plus API 请求权限
      // 参考: https://ext.dcloud.net.cn/plugin?id=594
      this.requestAppPermission(scope, resolve)
      // #endif

      // #ifdef H5
      // H5 端通过实际调用浏览器能力来触发权限请求
      this.requestH5Permission(scope, resolve)
      // #endif
    })
  }

  /**
   * 记录权限拒绝埋点
   */
  private recordDeny(scope: PermissionScope) {
    console.warn(`[PermissionService] 用户拒绝授权: ${scope}`)
    if (this.denyTracker) {
      const platform = typeof getPlatform === 'function' ? getPlatform() : 'unknown'
      this.denyTracker(scope, platform)
    }
  }

  /**
   * App 端查询权限状态（通过 plus 原生 API）
   * 参考: https://ext.dcloud.net.cn/plugin?id=594
   */
  private queryAppPermissionStatus(
    scope: PermissionScope,
    resolve: (status: PermissionStatus) => void,
  ) {
    // #ifdef APP-PLUS
    const isIos = plus.os.name === 'iOS'

    if (isIos) {
      resolve(this.checkIosPermission(scope))
      return
    }

    // Android: 通过 requestPermissions 查询（传入空数组不会弹窗，仅查询）
    const androidPermMap: Record<PermissionScope, string[]> = {
      location: ['android.permission.ACCESS_FINE_LOCATION'],
      camera: ['android.permission.CAMERA'],
      album: ['android.permission.READ_EXTERNAL_STORAGE'],
      userInfo: [],
    }
    const perms = androidPermMap[scope] || []
    if (perms.length === 0) {
      resolve('granted')
      return
    }

    plus.android.requestPermissions(
      perms,
      (result: any) => {
        const allGranted = perms.every((p: string) => result.granted?.includes(p))
        resolve(allGranted ? 'granted' : 'denied')
      },
      () => resolve('denied'),
    )
    // #endif
  }

  /**
   * iOS 端权限状态查询（通过 plus.ios 调用原生 API）
   * 参考: https://ext.dcloud.net.cn/plugin?id=594 permission.js
   */
  private checkIosPermission(scope: PermissionScope): PermissionStatus {
    // #ifdef APP-PLUS
    try {
      if (scope === 'location') {
        const cllocationManger = (plus.ios as any).import('CLLocationManager')
        const status = cllocationManger.authorizationStatus()
        plus.ios.deleteObject(cllocationManger)
        // 0=notDetermined, 1=restricted, 2=denied, 3=authorizedAlways, 4=authorizedWhenInUse
        if (status === 3 || status === 4)
          return 'granted'
        if (status === 2)
          return 'denied'
        return 'unasked'
      }

      if (scope === 'camera') {
        const AVCaptureDevice = (plus.ios as any).import('AVCaptureDevice')
        const authStatus = AVCaptureDevice.authorizationStatusForMediaType('vide')
        plus.ios.deleteObject(AVCaptureDevice)
        // 0=notDetermined, 1=restricted, 2=denied, 3=authorized
        if (authStatus === 3)
          return 'granted'
        if (authStatus === 2)
          return 'denied'
        return 'unasked'
      }

      if (scope === 'album') {
        const PHPhotoLibrary = (plus.ios as any).import('PHPhotoLibrary')
        const authStatus = PHPhotoLibrary.authorizationStatus()
        plus.ios.deleteObject(PHPhotoLibrary)
        if (authStatus === 3)
          return 'granted'
        if (authStatus === 2)
          return 'denied'
        return 'unasked'
      }

      // userInfo 等无需系统权限
      return 'granted'
    }
    catch (e) {
      console.error('[PermissionService] iOS 权限查询失败', e)
      return 'unasked'
    }
    // #endif
    return 'unasked'
  }

  /**
   * App 端权限请求（通过 plus API）
   * uni.authorize 不支持 App 平台，需使用原生能力
   * 参考: https://uniapp.dcloud.net.cn/api/other/authorize.html
   */
  private requestAppPermission(
    scope: PermissionScope,
    resolve: (status: PermissionStatus) => void,
  ) {
    // #ifdef APP-PLUS
    const isIos = plus.os.name === 'iOS'

    if (isIos) {
      // iOS 没有主动请求权限的 API，权限弹窗在首次调用对应系统能力时自动弹出
      // 先查询当前状态，若已授权则直接返回，否则标记为 granted 让后续 API 调用触发弹窗
      const status = this.checkIosPermission(scope)
      if (status === 'granted' || status === 'denied') {
        this.statusMap.set(scope, status)
        if (status === 'denied')
          this.recordDeny(scope)
        resolve(status)
      }
      else {
        // unasked: 标记为 granted，让后续 API 调用触发系统弹窗
        this.statusMap.set(scope, 'granted')
        resolve('granted')
      }
      return
    }

    // Android: 使用 plus.android.requestPermissions 主动请求权限
    const androidPermMap: Record<PermissionScope, string[]> = {
      location: ['android.permission.ACCESS_FINE_LOCATION', 'android.permission.ACCESS_COARSE_LOCATION'],
      camera: ['android.permission.CAMERA'],
      album: ['android.permission.READ_EXTERNAL_STORAGE'],
      userInfo: [],
    }

    const perms = androidPermMap[scope] || []

    // userInfo 不需要 Android 权限
    if (perms.length === 0) {
      this.statusMap.set(scope, 'granted')
      resolve('granted')
      return
    }

    plus.android.requestPermissions(
      perms,
      (result: any) => {
        // result: { granted: string[], deniedPresent: string[], deniedAlways: string[] }
        const allGranted = perms.every((p: string) => result.granted?.includes(p))
        if (allGranted) {
          this.statusMap.set(scope, 'granted')
          resolve('granted')
        }
        else {
          this.statusMap.set(scope, 'denied')
          this.recordDeny(scope)
          resolve('denied')
        }
      },
      (err: any) => {
        console.error('[PermissionService] App 权限请求失败', err)
        this.statusMap.set(scope, 'denied')
        this.recordDeny(scope)
        resolve('denied')
      },
    )
    // #endif
  }

  /**
   * 跳转到应用权限设置页
   * 参考: https://ext.dcloud.net.cn/plugin?id=594 gotoAppPermissionSetting
   */
  private gotoAppPermissionSetting(resolve: (result: boolean) => void) {
    // #ifdef APP-PLUS
    const isIos = plus.os.name === 'iOS'

    try {
      if (isIos) {
        // iOS: 使用 app-settings: 跳转到应用设置页
        const UIApplication = (plus.ios as any).import('UIApplication')
        const NSURL = (plus.ios as any).import('NSURL')
        const application = UIApplication.sharedApplication()
        const settingURL = NSURL.URLWithString('app-settings:')
        application.openURL(settingURL)
        plus.ios.deleteObject(settingURL)
        plus.ios.deleteObject(NSURL)
        plus.ios.deleteObject(application)
      }
      else {
        // Android: 使用 Intent 跳转到应用详情页
        const Intent = plus.android.importClass('android.content.Intent') as any
        const Settings = plus.android.importClass('android.provider.Settings') as any
        const Uri = plus.android.importClass('android.net.Uri') as any
        const mainActivity = plus.android.runtimeMainActivity() as any
        const intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
        const uri = Uri.fromParts('package', mainActivity.getPackageName(), null)
        intent.setData(uri)
        mainActivity.startActivity(intent)
      }
      this.statusMap.clear()
      resolve(true)
    }
    catch (e) {
      console.error('[PermissionService] 跳转设置页失败', e)
      resolve(false)
    }
    // #endif
  }

  /**
   * H5 端重新探测权限实际状态（绕过缓存）
   * 优先使用 Permissions API，不可用时尝试 Geolocation API 静默探测
   * 用于解决用户手动在浏览器设置中开启权限后，缓存仍为 denied 的问题
   */
  private async h5RecheckPermission(scope: PermissionScope): Promise<PermissionStatus> {
    // #ifdef H5
    // 策略 1：通过 Permissions API 静默查询
    const h5PermissionNameMap: Record<PermissionScope, PermissionName | null> = {
      location: 'geolocation',
      camera: 'camera' as PermissionName,
      album: null,
      userInfo: null,
    }
    const permName = h5PermissionNameMap[scope]

    if (permName && navigator.permissions?.query) {
      try {
        const result = await navigator.permissions.query({ name: permName })
        const statusMap: Record<string, PermissionStatus> = {
          granted: 'granted',
          denied: 'denied',
          prompt: 'unasked',
        }
        const status = statusMap[result.state] ?? 'unasked'
        if (status !== 'unasked') {
          return status
        }
      }
      catch {
        // Permissions API 查询失败，继续尝试策略 2
      }
    }

    // 策略 2：对于 location，通过 Geolocation API 快速探测
    // 使用极短超时，如果已授权则会很快返回成功
    if (scope === 'location' && navigator.geolocation) {
      return new Promise<PermissionStatus>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve('granted'),
          (error) => {
            if (error.code === error.PERMISSION_DENIED) {
              resolve('denied')
            }
            else {
              // TIMEOUT / POSITION_UNAVAILABLE 说明权限已授权（只是获取失败）
              resolve('granted')
            }
          },
          { timeout: 3000, enableHighAccuracy: false },
        )
      })
    }

    // 无法探测，保持原状态
    return 'denied'
    // #endif
    return 'denied'
  }

  /**
   * H5 端静默查询权限状态（通过 Permissions API）
   * 注意：Permissions API 兼容性有限，Safari 不支持
   */
  private queryH5PermissionStatus(
    scope: PermissionScope,
    resolve: (status: PermissionStatus) => void,
  ) {
    // #ifdef H5
    // Permissions API 仅支持部分权限名称映射
    const h5PermissionNameMap: Record<PermissionScope, PermissionName | null> = {
      location: 'geolocation',
      camera: 'camera' as PermissionName,
      album: null, // 浏览器无对应权限名
      userInfo: null,
    }

    const permName = h5PermissionNameMap[scope]

    // 无对应 Permissions API 名称，返回 unasked
    if (!permName || !navigator.permissions?.query) {
      resolve('unasked')
      return
    }

    navigator.permissions.query({ name: permName }).then((result) => {
      const statusMap: Record<string, PermissionStatus> = {
        granted: 'granted',
        denied: 'denied',
        prompt: 'unasked',
      }
      resolve(statusMap[result.state] ?? 'unasked')
    }).catch(() => {
      // Permissions API 查询失败，回退为 unasked
      resolve('unasked')
    })
    // #endif
  }

  /**
   * H5 端请求权限（通过实际调用浏览器能力触发授权弹窗）
   * - location: 通过 Geolocation API 尝试获取定位来判断
   * - camera: 通过 getUserMedia 尝试获取摄像头来判断
   * - 其他: 标记为 granted（由浏览器在后续调用时控制）
   */
  private requestH5Permission(
    scope: PermissionScope,
    resolve: (status: PermissionStatus) => void,
  ) {
    // #ifdef H5
    if (scope === 'location') {
      if (!navigator.geolocation) {
        console.error('[PermissionService] 该浏览器不支持定位功能')
        this.statusMap.set(scope, 'denied')
        resolve('denied')
        return
      }

      navigator.geolocation.getCurrentPosition(
        () => {
          this.statusMap.set(scope, 'granted')
          resolve('granted')
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            this.statusMap.set(scope, 'denied')
            this.recordDeny(scope)
            resolve('denied')
          }
          else {
            // POSITION_UNAVAILABLE / TIMEOUT 不代表用户拒绝，标记为 granted
            // 让后续定位调用自行处理这些错误
            this.statusMap.set(scope, 'granted')
            resolve('granted')
          }
        },
        { timeout: 5000, enableHighAccuracy: true },
      )
      return
    }

    if (scope === 'camera') {
      if (!navigator.mediaDevices?.getUserMedia) {
        console.error('[PermissionService] 该浏览器不支持摄像头功能')
        this.statusMap.set(scope, 'denied')
        resolve('denied')
        return
      }

      navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
        // 获取成功后立即停止所有轨道，释放摄像头
        stream.getTracks().forEach(track => track.stop())
        this.statusMap.set(scope, 'granted')
        resolve('granted')
      }).catch((error) => {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          this.statusMap.set(scope, 'denied')
          this.recordDeny(scope)
          resolve('denied')
        }
        else {
          // 其他错误（设备不可用等）不代表用户拒绝
          this.statusMap.set(scope, 'granted')
          resolve('granted')
        }
      })
      return
    }

    // album / userInfo 等无需浏览器权限弹窗
    this.statusMap.set(scope, 'granted')
    resolve('granted')
    // #endif
  }

  /**
   * H5 端引导用户手动进入浏览器设置页开启权限
   * 浏览器安全机制限制，无法通过代码直接打开设置页
   */
  private guideH5UserToSettings(resolve: (result: boolean) => void) {
    // #ifdef H5
    const toast = useGlobalToast()
    toast.show({
      msg: '请在浏览器地址栏左侧点击锁图标，手动开启相关权限',
      duration: 4000,
    })
    // 清除缓存，下次重新检测
    this.statusMap.clear()
    resolve(false)
    // #endif
  }

  /**
   * 检查设备系统定位服务是否开启
   * 参考: https://ext.dcloud.net.cn/plugin?id=594 checkSystemEnableLocation
   * @returns 是否开启系统定位服务
   */
  checkSystemEnableLocation(): boolean {
    // #ifdef APP-PLUS
    const isIos = plus.os.name === 'iOS'

    try {
      if (isIos) {
        const cllocationManger = (plus.ios as any).import('CLLocationManager')
        const enabled = cllocationManger.locationServicesEnabled()
        plus.ios.deleteObject(cllocationManger)
        return !!enabled
      }
      else {
        const Context = plus.android.importClass('android.content.Context') as any
        const LocationManager = plus.android.importClass('android.location.LocationManager') as any
        const main = plus.android.runtimeMainActivity() as any
        const mainSvr = main.getSystemService(Context.LOCATION_SERVICE)
        const enabled = mainSvr.isProviderEnabled(LocationManager.GPS_PROVIDER)
        return !!enabled
      }
    }
    catch (e) {
      console.error('[PermissionService] 检查系统定位服务失败', e)
      return false
    }
    // #endif

    // 非 App 平台默认返回 true
    return true
  }
}

/** 单例实例 */
let instance: PermissionService | null = null

/**
 * 获取权限服务单例
 */
export function getPermissionService(): PermissionService {
  if (!instance) {
    instance = new PermissionService()
  }
  return instance
}
