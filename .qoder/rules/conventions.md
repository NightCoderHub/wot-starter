---
trigger: always_on
---
# Wot Starter 开发规范

## Vue 组件

- 必须使用 `<script setup lang="ts">` + Composition API
- 页面文件放在 `src/pages/`（主包）或 `src/subPages/`（分包）
- 全局组件放在 `src/components/`，会被自动注册
- 组合式函数放在 `src/composables/`，会被自动导入
- 页面使用 `definePage()` 宏声明路由元信息（name、layout、style）

## 样式

- Wot UI 主题变量使用 `wot-` 前缀的语义化类名（如 `wot-text-text-main`、`wot-bg-filled-oppo`）
- 需要自定义样式时使用 `<style scoped lang="scss">`
- 避免写硬编码颜色值，使用 Wot UI 语义化 token

## 网络请求

- 所有 API 请求必须通过 Alova 实例发起（`src/api/`）
- API 定义集中在 `src/api/apiDefinitions.ts`
- 使用 `useRequest` / `usePagination` 等 Alova hooks
- Mock 数据放在 `src/api/mock/modules/`

## 状态管理

- 使用 Pinia store 管理全局状态，store 文件放在 `src/store/`
- Store 会被自动导入，无需手动 import
- 需要持久化的状态使用 persist 插件

## 路由与导航

- 使用 `@wot-ui/router` 的 `useRouter` / `useRoute`（已自动导入）
- 页面跳转使用 `router.push({ name: 'xxx' })` 命名路由方式
- 布局通过 `layout` 字段指定（`default` 或 `tabbar`）

## 文件命名

- 组件文件：PascalCase（如 `GlobalToast.vue`）
- 组合式函数：`use` 前缀 camelCase（如 `useTheme.ts`）
- 页面目录：kebab-case（如 `subPages/router/`）
- 工具函数：camelCase（如 `formatter/`、`validator/`）

## 多端适配

- 使用 uni-app 条件编译注释处理平台差异（如 `// #ifdef MP-ALIPAY`）
- 避免直接使用浏览器 API，优先使用 uni API
- 自定义 TabBar 适配逻辑在 `src/customize-tab-bar/`

