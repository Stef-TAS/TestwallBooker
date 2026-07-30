<script lang="ts" setup>
import { Button, Card, CommandMenu, Dialog, Select, Tag } from 'primevue'
import Terminal from 'primevue/terminal'
import TerminalService from 'primevue/terminalservice'

import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import Toast from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import { storeToRefs } from 'pinia'
import { useTestwallsStore } from '../stores/testwalls'
import { useCommandsStore, type Command } from '../stores/commands'
import { useAccountStore } from '@/stores/account'
const toast = useToast()

const accountStore = useAccountStore()

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

const commandsStore = useCommandsStore()
const { commands } = storeToRefs(commandsStore)
const { loadCommands } = commandsStore

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
        toast.add({
          severity: 'info',
          summary: 'Copied to Clipboard',
          detail:
            'The selected Command was copied to your Clipboard, please paste it into the terminal.',
          life: 10000,
        })
      },
    })),
  }))
})

const testwallsStore = useTestwallsStore()
const { testwallsWithAvailability } = storeToRefs(testwallsStore)
const { loadTestwalls } = testwallsStore

onMounted(() => {
  void loadCommands()
  void loadTestwalls()
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
  <Toast />
  <Card class="relative overflow-hidden border border-blue-500/20 shadow-xl mb-6">
    <template #content>
      <div class="absolute -top-24 -right-16 h-48 w-48 rounded-full bg-blue-500/15 blur-2xl" />
      <div class="absolute -bottom-28 -left-16 h-56 w-56 rounded-full bg-cyan-500/15 blur-2xl" />

      <div class="relative z-10">
        <div class="flex flex-wrap items-center gap-2 mb-3">
          <Tag severity="info" value="Pseudo Terminal" />
          <Tag severity="warn" value="Command Palette: Ctrl/Cmd + L" />
        </div>

        <h1 class="text-3xl font-semibold tracking-tight">Terminal</h1>
        <p class="mt-3 text-sm leading-6 opacity-80 max-w-3xl">
          Run predefined commands for your testwall workflow and use the built-in command list for
          faster, more consistent execution.
        </p>
      </div>
    </template>
  </Card>
  <div v-if="accountStore.showAdminContent" class="mb-4">
    <p>Admin Terminal Select</p>
    <Select
      :options="testwallsWithAvailability"
      placeholder="Select a Testwall"
      optionLabel="name"
      filter
      filterBy="name"
    >
      <template #option="slotProps">
        <div class="flex gap-4 justify-between">
          <span>{{ slotProps.option.name }} </span>
          <Tag v-if="slotProps.option.isAvailable == true" severity="success">Available</Tag>
          <Tag v-if="slotProps.option.isAvailable == false" severity="danger">Unavailable</Tag>
        </div>
      </template>
    </Select>
  </div>
  <div>
    <Terminal
      welcomeMessage='Welcome to the Testwall Terminal. Type "help" for available commands.'
      prompt="$"
      class="w-full max-w-4/5 justify-self-center shadow-xl"
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
