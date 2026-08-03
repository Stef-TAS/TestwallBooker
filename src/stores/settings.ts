import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

export const useSettingsStore = defineStore('settings', () => {
  // Default 24h to true so the existing time display doesn't change for new users
  const use24HourTime = ref(localStorage.getItem('use24HourTime') !== 'false')
  const compactView = ref(localStorage.getItem('compactView') === 'true')

  watch(use24HourTime, (v) => localStorage.setItem('use24HourTime', String(v)))
  watch(compactView, (v) => localStorage.setItem('compactView', String(v)))

  return { use24HourTime, compactView }
})
