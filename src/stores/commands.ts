import { ref } from 'vue'
import { defineStore } from 'pinia'

export type Command = {
  commandName: string
  commandCategory: string
  commandDescription: string
}

const commandsFileUrl = new URL('../data/commands.json', import.meta.url).href

export const useCommandsStore = defineStore('commands', () => {
  const commands = ref<Command[]>([])
  const isLoading = ref(false)
  const loadError = ref('')
  const hasLoaded = ref(false)

  async function loadCommands(force = false) {
    if (isLoading.value) {
      return
    }

    if (hasLoaded.value && !force) {
      return
    }

    try {
      isLoading.value = true
      loadError.value = ''

      const response = await fetch(commandsFileUrl)
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`)
      }

      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        throw new Error('Data file did not return JSON content')
      }

      const data = (await response.json()) as Command[]
      commands.value = data
      hasLoaded.value = true
    } catch (error) {
      loadError.value = error instanceof Error ? error.message : 'Unknown error'
    } finally {
      isLoading.value = false
    }
  }

  return { commands, isLoading, loadError, hasLoaded, loadCommands }
})
