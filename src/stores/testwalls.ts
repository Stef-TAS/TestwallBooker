import { ref } from 'vue'
import { defineStore } from 'pinia'

export type Testwall = {
  testwallId: number
  testwallName: string
  isAvailable: boolean
  user: string
}

const testwallsFileUrl = new URL('../data/testwalls.json', import.meta.url).href

export const useTestwallsStore = defineStore('testwalls', () => {
  const testwalls = ref<Testwall[]>([])
  const isLoading = ref(false)
  const loadError = ref('')
  const hasLoaded = ref(false)

  async function loadTestwalls(force = false) {
    if (isLoading.value) {
      return
    }

    if (hasLoaded.value && !force) {
      return
    }

    try {
      isLoading.value = true
      loadError.value = ''

      const response = await fetch(testwallsFileUrl)
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`)
      }

      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        throw new Error('Data file did not return JSON content')
      }

      const data = (await response.json()) as Testwall[]
      testwalls.value = data
      hasLoaded.value = true
    } catch (error) {
      loadError.value = error instanceof Error ? error.message : 'Unknown error'
    } finally {
      isLoading.value = false
    }
  }

  return { testwalls, isLoading, loadError, hasLoaded, loadTestwalls }
})
