<script lang="ts" setup>
import { CommandMenu, Dialog } from 'primevue'
import Terminal from 'primevue/terminal'
import TerminalService from 'primevue/terminalservice'

import { computed, onMounted, onBeforeUnmount, ref } from 'vue'

async function copyCommandToClipboard(commandName: string) {
  try {
    await navigator.clipboard.writeText(commandName)
    visible.value = false
    TerminalService.emit('response', `Copied command to clipboard: ${commandName}`)
  } catch {
    TerminalService.emit('response', `Failed to copy command: ${commandName}`)
  }
}

const commandHandler = (text: string) => {
  const argsIndex = text.indexOf(' ')
  const command = argsIndex !== -1 ? text.substring(0, argsIndex) : text
  let response
  switch (command) {
    case 'help':
      response =
        'Available commands:\n  date    - Display current date and time\n  greet   - Get a personalized greeting\n  random  - Generate a random number\n  clear   - Clear the terminal'
      break
    case 'date':
      response = new Date().toLocaleString()
      break
    case 'greet': {
      const name = text.substring(argsIndex + 1).trim() || 'World'
      response = `Hello, ${name}!`
      break
    }
    case 'random':
      response = `Your random number: ${Math.floor(Math.random() * 100)}`
      break
    default:
      response = `Command not found: ${command}. Type "help" for available commands.`
  }
  TerminalService.emit('response', response)
}

function onHotkey(event: any) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'l') {
    event.preventDefault()
    visible.value = !visible.value
  }
}

type Command = {
  commandName: string
  commandCategory: string
  commandDescription: string
}
const commands = ref<Command[]>([])

const groupedCommands = computed(() => {
  const groups = new Map<string, Command[]>()

  for (const command of commands.value) {
    const existing = groups.get(command.commandCategory)
    if (existing) {
      existing.push(command)
      continue
    }
    groups.set(command.commandCategory, [command])
  }

  return Array.from(groups.entries()).map(([category, items]) => ({
    label: category,
    items: items.map((command) => ({
      label: command.commandName,
      commandDescription: command.commandDescription,
      keywords: [command.commandCategory, command.commandDescription],
      command: () => {
        void copyCommandToClipboard(command.commandName)
      },
    })),
  }))
})

const commandsFileUrl = new URL('../data/commands.json', import.meta.url).href

async function loadCommands() {
  try {
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
  } catch (error) {}
}

onMounted(() => {
  void loadCommands()
  TerminalService.on('command', commandHandler)
  window.addEventListener('keydown', onHotkey)
})
onBeforeUnmount(() => {
  TerminalService.off('command', commandHandler)
  window.removeEventListener('keydown', onHotkey)
})

const visible = ref(false)
</script>
<template>
  <div class="mb-4">
    <p class="text-2xl">Terminal</p>
    <p class="text-sm">
      Here you can use predefined Commands to run on the testwalls (see list bellow)
    </p>
  </div>
  <div>
    <Terminal
      welcomeMessage='Welcome to the Testwall Terminal. Type "help" for available commands.'
      prompt="$"
    />
  </div>
  <div>
    <div class="m-4 justify-self-center">
      <span @click="visible = true"
        >Press
        <kbd
          class="bg-surface-100 dark:bg-surface-950 px-2 py-1 rounded-md border border-surface-200 dark:border-surface-700/50 text-sm ml-2"
          >CTRL/CMD/ + L</kbd
        >
        for command list</span
      >
    </div>
    <Dialog v-model:visible="visible" modal :closable="false" :showHeader="false" class="w-4/5">
      <CommandMenu
        :model="groupedCommands"
        placeholder="Search for commands..."
        class="mx-auto mt-5"
      >
        <template #submenulabel="{ item }">
          <span class="px-2.25">{{ item.label }}</span>
        </template>
        <template #item="{ item }">
          <span class="px-2.25">{{ item.label }}</span>
          <span class="px-2.25 opacity-50 ml-auto">{{ item.commandDescription }}</span>
        </template>
      </CommandMenu>
    </Dialog>
  </div>
</template>
