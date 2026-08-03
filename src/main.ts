import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import Tooltip from 'primevue/tooltip'
import { definePreset, palette } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'
import 'primeicons/primeicons.css'

import App from './App.vue'
import router from './router'
import './style.css'

const storedTheme = localStorage.getItem('theme') ?? 'light'
const darkThemes = ['dark', 'ocean', 'highcontrast']
if (darkThemes.includes(storedTheme)) {
  document.documentElement.classList.add('dark')
}
document.documentElement.setAttribute('data-theme', storedTheme)

const AppPreset = definePreset(Aura, {
  semantic: {
    primary: palette('#211fc8'),
  },
})

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(PrimeVue, {
  theme: {
    preset: AppPreset,
    options: {
      darkModeSelector: '.dark',
    },
  },
})
app.use(ToastService)
app.directive('tooltip', Tooltip)

app.mount('#app')
