// #ifdef H5
import VConsole from 'vconsole'
import { createSSRApp } from 'vue'
import App from './App.vue'
import router from './router'

import 'uno.css'
// #endif

const pinia = createPinia()
pinia.use(persistPlugin)
export function createApp() {
  const app = createSSRApp(App)
  app.use(router)
  app.use(pinia)

  // #ifdef H5
  if (import.meta.env.DEV) {
    const vConsole = new VConsole()
    void vConsole
  }
  // #endif

  return {
    app,
  }
}
