# 获取用户位置 — 权限流转架构

> 本文档描述定位服务在多端环境下的权限流转逻辑，涵盖微信小程序、支付宝小程序、App（iOS/Android）、H5 四端。

---

## 一、整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                         业务页面（pages/）                           │
│   permService.checkPermission('location')                           │
│   permService.requestPermission('location')                         │
│   locService.getCurrentLocation()                                   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────────────┐
│ PermissionService│ │ LocationService  │ │  腾讯 WebService API     │
│ 权限状态管理      │ │ 定位数据获取      │ │  逆地址解析              │
│ 三段式状态缓存    │ │ TTL 持久化缓存   │ │  reverseGeocode()        │
│ 幂等防抖         │ │ 超时控制         │ │                          │
└────────┬─────────┘ └────────┬─────────┘ └──────────────────────────┘
         │                    │
         │    ┌───────────────┘
         ▼    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     平台原生能力（条件编译）                          │
│  MP-WEIXIN  → wx.authorize / wx.getSetting / wx.openSetting        │
│  MP-ALIPAY  → my.getAuthCode / my.getSetting / my.openSetting      │
│  APP-PLUS   → plus.ios.import / plus.android.requestPermissions    │
│  H5         → 腾讯前端定位组件（index.html 静态引入）               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 二、权限三段式状态模型

权限状态采用三段式模型，比 uni-app 原生的 boolean 更精细：

| 状态 | 含义 | 触发条件 |
|------|------|---------|
| `unasked` | 从未询问过 | 首次使用、用户未操作过 |
| `granted` | 已授权 | 用户同意授权 |
| `denied` | 已拒绝 | 用户拒绝授权 |

```
          ┌─────────┐
          │ unasked │  ← 初始状态
          └────┬────┘
               │ requestPermission()
               ▼
        ┌──────┴──────┐
        ▼             ▼
   ┌─────────┐   ┌─────────┐
   │ granted │   │ denied  │
   └─────────┘   └────┬────┘
                      │ openSetting() → 设置页
                      ▼
                 ┌─────────┐
                 │ granted │  （重新查询状态）
                 └─────────┘
```

---

## 三、权限流转完整时序

### 3.1 正常授权流程

```
业务页面          PermissionService         平台 API
   │                    │                      │
   │ checkPermission()  │                      │
   ├───────────────────►│                      │
   │                    │ querySystemStatus()  │
   │                    ├─────────────────────►│
   │                    │◄─────────────────────┤  unasked
   │◄───────────────────┤  'unasked'           │
   │                    │                      │
   │ requestPermission()│                      │
   ├───────────────────►│                      │
   │                    │ doRequestPermission()│
   │                    ├─────────────────────►│  弹出系统授权弹窗
   │                    │◄─────────────────────┤  用户点击同意
   │◄───────────────────┤  'granted'           │
   │                    │                      │
   │ getCurrentLocation()                      │
   ├───────────────────────────────────────────►│  调用定位 API
   │◄──────────────────────────────────────────┤  返回坐标
```

### 3.2 拒绝后引导流程

```
业务页面          PermissionService         LocationService
   │                    │                      │
   │ requestPermission()│                      │
   ├───────────────────►│                      │
   │                    │  用户拒绝             │
   │◄───────────────────┤  'denied'            │
   │                    │                      │
   │                    │  guideUserToSetting() │
   │                    │  ┌───────────────────┐│
   │                    │  │ 弹窗：去设置？     ││
   │                    │  └───────┬───────────┘│
   │                    │          │ 用户点击确定│
   │                    │  openSetting()        │
   │                    │  跳转系统设置页        │
   │                    │  ◄────────────────────│  用户手动开启
   │                    │  statusMap.clear()    │
   │                    │  重新查询状态          │
```

---

## 四、各平台实现差异

### 4.1 微信小程序

| 操作 | API | Scope |
|------|-----|-------|
| 查询状态 | `wx.getSetting` | `scope.userLocation` |
| 请求权限 | `wx.authorize` | `scope.userLocation` |
| 跳转设置 | `wx.openSetting` | — |

**注意**：`wx.authorize` 只能触发一次弹窗，用户拒绝后只能通过 `wx.openSetting` 引导。

### 4.2 支付宝小程序

| 操作 | API | Scope |
|------|-----|-------|
| 查询状态 | `my.getSetting` | `location` |
| 请求权限 | `my.getAuthCode` | `location` |
| 跳转设置 | `my.openSetting` | — |

### 4.3 App 端（iOS）

| 操作 | 实现方式 |
|------|---------|
| 查询状态 | `plus.ios.import('CLLocationManager').authorizationStatus()` |
| 请求权限 | 无法主动弹窗，首次调用定位 API 时系统自动弹出 |
| 跳转设置 | `UIApplication.openURL('app-settings:')` |

**iOS 权限状态码映射**：

| 原生值 | 含义 | 映射状态 |
|--------|------|---------|
| 0 | notDetermined | `unasked` |
| 1 | restricted | `unasked` |
| 2 | denied | `denied` |
| 3 | authorizedAlways | `granted` |
| 4 | authorizedWhenInUse | `granted` |

**关键陷阱**：`uni.authorize` 不支持 App 平台（官方文档标注为 ×），必须使用 `plus.ios.import` 查询原生权限状态。

### 4.4 App 端（Android）

| 操作 | 实现方式 |
|------|---------|
| 查询状态 | `plus.android.requestPermissions(perms)` 查询（不弹窗） |
| 请求权限 | `plus.android.requestPermissions(perms)` 主动请求 |
| 跳转设置 | `Intent(ACTION_APPLICATION_DETAILS_SETTINGS)` + `Uri.fromParts('package', ...)` |

**Android 权限映射**：

| Scope | Android 权限 |
|-------|-------------|
| location | `ACCESS_FINE_LOCATION` + `ACCESS_COARSE_LOCATION` |
| camera | `CAMERA` |
| album | `READ_EXTERNAL_STORAGE` |

### 4.5 H5 端

| 操作 | 实现方式 |
|------|---------|
| 权限管理 | 浏览器原生管理，无法通过 JS 主动请求 |
| 定位 | 腾讯前端定位组件（`window.LBS.WebComponent.Geolocation`） |
| 脚本引入 | `index.html` 静态 `<script>` 标签 |

**腾讯组件状态码映射**：

| 状态码 | 含义 | 映射错误 |
|--------|------|---------|
| 10101 | 权限拒绝 | `PERMISSION_DENIED` |
| 10103 | 超时 | `TIMEOUT` |
| 其他 | 未知失败 | `UNAVAILABLE` |

---

## 五、关键设计决策

### 5.1 幂等防抖

同一 scope 并发调用 `requestPermission` 时，复用同一个 Promise，避免重复弹窗：

```ts
// 已有 pending 请求 → 直接复用
const pending = this.pendingRequests.get(scope)
if (pending) return pending
```

### 5.2 定位缓存持久化

缓存写入 `uni.setStorage`（非内存），支持：
- 跨页面复用定位结果
- App 杀进程后 `getLastKnownLocation()` 仍可兜底
- TTL 过期手动检查，过期数据保留用于失败兜底

### 5.3 系统定位服务检查

App 端额外提供 `checkSystemEnableLocation()` 检查设备级定位开关：
- iOS：`CLLocationManager.locationServicesEnabled()`
- Android：`LocationManager.isProviderEnabled(GPS_PROVIDER)`

即使权限已授予，系统定位服务关闭时仍无法获取位置。

---

## 六、错误处理策略

```
LocationError
├── PERMISSION_DENIED  → 引导弹窗 → openSetting()
├── TIMEOUT            → 提示用户重试
├── UNAVAILABLE        → 检查网络/GPS 开关
└── CANCELLED          → 静默处理
```

**兜底机制**：非权限错误时，优先返回过期缓存（标记 `stale: true`），保证业务不中断。

---

## 七、文件结构

```
src/services/
├── types.ts                  # 共享类型：PermissionStatus、LocationResult、LocationError
├── permission.service.ts     # 权限守卫：状态管理、多端适配、设置页跳转
└── location.service.ts       # 定位数据：获取、缓存、逆地址解析

src/pages/location/
└── index.vue                 # 测试页面：验证各功能是否正常
```
