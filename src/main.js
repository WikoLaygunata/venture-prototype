import { createApp } from 'vue'

import './assets/main.css'
import App from './App.vue'
import router from './router'
import { initAuth } from './stores/auth'

// Resolve the session before the first navigation so guards are never racy.
initAuth().finally(() => {
  createApp(App).use(router).mount('#app')
})
