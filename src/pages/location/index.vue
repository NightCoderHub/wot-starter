<script setup lang="ts">
import type { LocationResult, ReverseGeocodeResult } from '@/services/types'
import { getLocationService } from '@/services/location.service'
import { getPermissionService } from '@/services/permission.service'

definePage({
  name: 'location-test',
  layout: 'default',
  style: {
    navigationBarTitleText: '定位服务测试',
  },
})

const permService = getPermissionService()
const locService = getLocationService()

// 状态
const loading = ref(false)
const logs = ref<string[]>([])
const locationResult = ref<LocationResult | null>(null)
const reverseResult = ref<ReverseGeocodeResult | null>(null)

// 地图状态
const mapCenter = ref({
  latitude: 39.908823,
  longitude: 116.397470,
})
const mapScale = ref(14)
const markers = ref<any[]>([])
const showLocation = ref(false)
const mapContext = ref<UniApp.MapContext | null>(null)

onMounted(() => {
  mapContext.value = uni.createMapContext('locationMap')
})

function addLog(msg: string) {
  const time = new Date().toLocaleTimeString()
  logs.value.unshift(`[${time}] ${msg}`)
}

/** 更新地图中心和标记点 */
function updateMap(result: LocationResult) {
  mapCenter.value = {
    latitude: result.latitude,
    longitude: result.longitude,
  }
  markers.value = [{
    id: 1,
    latitude: result.latitude,
    longitude: result.longitude,
    title: reverseResult.value?.recommend || reverseResult.value?.address || '当前位置',
    callout: {
      content: reverseResult.value?.recommend || reverseResult.value?.address || `${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)}`,
      display: 'ALWAYS',
      fontSize: 13,
      borderRadius: 6,
      padding: 8,
      bgColor: '#ffffff',
      color: '#333333',
    },
    iconPath: '',
    width: 30,
    height: 30,
  }]
  showLocation.value = true
}

// 检查权限
async function checkPermission() {
  loading.value = true
  try {
    const status = await permService.checkPermission('location')
    addLog(`权限状态: ${status}`)
  }
  catch (e: any) {
    addLog(`检查权限失败: ${e.message}`)
  }
  finally {
    loading.value = false
  }
}

// 请求权限
async function requestPermission() {
  loading.value = true
  try {
    const status = await permService.requestPermission('location')
    addLog(`请求权限结果: ${status}`)
  }
  catch (e: any) {
    addLog(`请求权限失败: ${e.message}`)
  }
  finally {
    loading.value = false
  }
}

// 获取定位
async function getLocation() {
  loading.value = true
  try {
    const result = await locService.getCurrentLocation()
    locationResult.value = result
    updateMap(result)
    addLog(`定位成功: ${result.latitude.toFixed(6)}, ${result.longitude.toFixed(6)}${result.stale ? ' (缓存兜底)' : ''}`)
  }
  catch (e: any) {
    addLog(`定位失败: [${e.code}] ${e.message}`)
  }
  finally {
    loading.value = false
  }
}

// 获取最后已知位置
function getLastKnown() {
  const last = locService.getLastKnownLocation()
  if (last) {
    addLog(`最后已知位置: ${last.latitude.toFixed(6)}, ${last.longitude.toFixed(6)}${last.stale ? ' (已过期)' : ''}`)
    mapCenter.value = {
      latitude: last.latitude,
      longitude: last.longitude,
    }
  }
  else {
    addLog('暂无已知位置')
  }
}

// 逆地址解析
async function reverseGeocode() {
  if (!locationResult.value) {
    addLog('请先获取定位')
    return
  }
  loading.value = true
  try {
    const result = await locService.reverseGeocode(
      locationResult.value.latitude,
      locationResult.value.longitude,
    )
    reverseResult.value = result
    // 更新地图标记点的气泡文案
    updateMap(locationResult.value)
    addLog(`逆地址解析: ${result.address}`)
    if (result.recommend) {
      addLog(`推荐地址: ${result.recommend}`)
    }
  }
  catch (e: any) {
    addLog(`逆地址解析失败: ${e.message}`)
  }
  finally {
    loading.value = false
  }
}

// 获取当前位置文字描述
async function getCurrentAddress() {
  loading.value = true
  try {
    const result = await locService.getCurrentAddress()
    reverseResult.value = result
    addLog(`当前位置: ${result.address}`)
    if (result.recommend) {
      addLog(`推荐: ${result.recommend}`)
    }
  }
  catch (e: any) {
    addLog(`获取地址失败: [${e.code}] ${e.message}`)
  }
  finally {
    loading.value = false
  }
}

// 地图移回当前位置
function moveToLocation() {
  if (!locationResult.value) {
    addLog('暂无定位数据')
    return
  }
  mapContext.value?.moveToLocation({
    latitude: locationResult.value.latitude,
    longitude: locationResult.value.longitude,
    success: () => addLog('地图已移回当前位置'),
    fail: (err: any) => addLog(`移动地图失败: ${err.errMsg || err}`),
  })
}

// 检查系统定位服务
function checkSystemLocation() {
  const enabled = permService.checkSystemEnableLocation?.() ?? true
  addLog(`系统定位服务: ${enabled ? '已开启' : '未开启'}`)
}

// 清除缓存
function clearCache() {
  locService.clearCache()
  locationResult.value = null
  reverseResult.value = null
  markers.value = []
  showLocation.value = false
  addLog('缓存已清除')
}

// 清空日志
function clearLogs() {
  logs.value = []
}

// 页面卸载时清理资源
onUnload(() => {
  permService.destroy()
  locService.destroy()
})
</script>

<template>
  <view class="min-h-screen bg-gray-50 p-4 dark:bg-gray-900">
    <!-- 地图区域 -->
    <view class="mb-4 overflow-hidden rounded-3 bg-white dark:bg-gray-800">
      <view class="flex items-center justify-between border-b border-gray-100 px-4 py-2 dark:border-gray-700">
        <text class="text-4 font-bold">
          地图
        </text>
        <wd-button size="small" plain :disabled="!locationResult" @click="moveToLocation">
          回到当前位置
        </wd-button>
      </view>
      <map
        id="locationMap"
        :latitude="mapCenter.latitude"
        :longitude="mapCenter.longitude"
        :scale="mapScale"
        :markers="markers"
        :show-location="showLocation"
        class="w-full"
        style="height: 300px;"
      />
    </view>

    <!-- 操作区 -->
    <view class="mb-4 rounded-3 bg-white p-4 dark:bg-gray-800">
      <text class="mb-3 block text-4 font-bold">
        权限操作
      </text>
      <view class="flex flex-wrap gap-2">
        <wd-button size="small" @click="checkPermission">
          检查权限
        </wd-button>
        <wd-button size="small" type="warning" @click="requestPermission">
          请求权限
        </wd-button>
      </view>
    </view>

    <view class="mb-4 rounded-3 bg-white p-4 dark:bg-gray-800">
      <text class="mb-3 block text-4 font-bold">
        定位操作
      </text>
      <view class="flex flex-wrap gap-2">
        <wd-button size="small" type="primary" :loading="loading" @click="getLocation">
          获取定位
        </wd-button>
        <wd-button size="small" @click="getLastKnown">
          最后已知位置
        </wd-button>
        <wd-button size="small" @click="checkSystemLocation">
          检查系统定位
        </wd-button>
        <wd-button size="small" type="danger" @click="clearCache">
          清除缓存
        </wd-button>
      </view>
    </view>

    <view class="mb-4 rounded-3 bg-white p-4 dark:bg-gray-800">
      <text class="mb-3 block text-4 font-bold">
        逆地址解析
      </text>
      <view class="flex flex-wrap gap-2">
        <wd-button size="small" type="primary" :disabled="!locationResult" @click="reverseGeocode">
          逆地址解析
        </wd-button>
        <wd-button size="small" type="primary" :loading="loading" @click="getCurrentAddress">
          获取当前位置
        </wd-button>
      </view>
    </view>

    <!-- 定位结果 -->
    <view v-if="locationResult" class="mb-4 rounded-3 bg-white p-4 dark:bg-gray-800">
      <text class="mb-2 block text-4 font-bold">
        定位结果
      </text>
      <view class="text-3 space-y-1">
        <text class="block">
          经度: {{ locationResult.longitude.toFixed(6) }}
        </text>
        <text class="block">
          纬度: {{ locationResult.latitude.toFixed(6) }}
        </text>
        <text v-if="locationResult.accuracy" class="block">
          精度: {{ locationResult.accuracy }}m
        </text>
        <text v-if="locationResult.stale" class="block text-orange-500">
          ⚠️ 缓存数据（已过期）
        </text>
      </view>
    </view>

    <!-- 逆地址解析结果 -->
    <view v-if="reverseResult" class="mb-4 rounded-3 bg-white p-4 dark:bg-gray-800">
      <text class="mb-2 block text-4 font-bold">
        地址信息
      </text>
      <view class="text-3 space-y-1">
        <text class="block">
          {{ reverseResult.address }}
        </text>
        <text v-if="reverseResult.recommend" class="block text-blue-500">
          {{ reverseResult.recommend }}
        </text>
        <text class="block">
          {{ reverseResult.addressComponent.province }}
          {{ reverseResult.addressComponent.city }}
          {{ reverseResult.addressComponent.district }}
        </text>
        <text class="block text-gray-400">
          行政区划代码: {{ reverseResult.adInfo.adcode }}
        </text>
      </view>
    </view>

    <!-- 日志区 -->
    <view class="rounded-3 bg-white p-4 dark:bg-gray-800">
      <view class="mb-2 flex items-center justify-between">
        <text class="text-4 font-bold">
          日志
        </text>
        <wd-button size="small" plain @click="clearLogs">
          清空
        </wd-button>
      </view>
      <scroll-view scroll-y class="max-h-60">
        <view v-if="logs.length === 0" class="py-4 text-center text-3 text-gray-400">
          暂无日志
        </view>
        <text
          v-for="(log, idx) in logs"
          :key="idx"
          class="mb-1 block text-2.5 text-gray-600 font-mono dark:text-gray-400"
        >
          {{ log }}
        </text>
      </scroll-view>
    </view>
  </view>
</template>
