<script lang="ts" setup>
import { useSettingsStore } from '@/stores/settings'
import { Button, Card, Divider, Tag } from 'primevue'

const settingsStore = useSettingsStore()

const availableToday = [
  {
    title: 'Overview',
    description: 'Live availability, current booking owner, and machine-user visibility.',
    action: '/overview',
    buttonLabel: 'Open Overview',
  },
  {
    title: 'Booking History',
    description: 'Booking outcomes and timelines for finished, active, and interrupted runs.',
    action: '/booking',
    buttonLabel: 'Open Booking',
  },
  {
    title: 'Waldies',
    description: 'Mapped hardware details, status, and copy-ready technical information.',
    action: '/waldies',
    buttonLabel: 'Open Waldies',
  },
]

const plannedCapabilities = [
  'Filtered lookup by testwall, status, and owner',
  'Saved query presets for recurring operational checks',
  'Unified timeline view for bookings, command usage, and interventions',
]
</script>
<template>
  <div :class="['max-w-5xl mx-auto pb-10', { 'compact-page': settingsStore.compactView }]">
    <Card class="relative overflow-hidden border border-indigo-500/20 shadow-xl mb-6">
      <template #content>
        <div class="absolute -top-24 -right-16 h-48 w-48 rounded-full bg-indigo-500/15 blur-2xl" />
        <div class="absolute -bottom-28 -left-16 h-56 w-56 rounded-full bg-cyan-500/15 blur-2xl" />

        <div class="relative z-10">
          <div class="flex flex-wrap items-center gap-2 mb-3">
            <Tag severity="info" value="Query Workspace" />
            <Tag severity="warn" value="In Progress" />
          </div>

          <h1 class="text-3xl font-semibold tracking-tight">Query Center</h1>
          <p class="mt-3 text-sm leading-6 opacity-80 max-w-3xl">
            This page is reserved for advanced query workflows. Until full query tooling is added,
            use the pages below for the same operational insights.
          </p>
        </div>
      </template>
    </Card>

    <Card class="shadow-lg mb-6">
      <template #content>
        <h2 class="text-xl font-semibold">Where to Find Information Today</h2>
        <Divider class="my-3" />
        <div class="grid gap-3 md:grid-cols-3">
          <Card
            v-for="item in availableToday"
            :key="item.title"
            class="transition-transform duration-150 hover:scale-[1.02]"
          >
            <template #content>
              <p class="text-sm font-semibold mb-2">{{ item.title }}</p>
              <p class="text-sm leading-6 opacity-80 mb-3">{{ item.description }}</p>
              <Button
                :label="item.buttonLabel"
                size="small"
                severity="secondary"
                @click="$router.push(item.action)"
              />
            </template>
          </Card>
        </div>
      </template>
    </Card>

    <Card class="border border-cyan-500/20 shadow-lg">
      <template #content>
        <h2 class="text-xl font-semibold">Planned Query Capabilities</h2>
        <Divider class="my-3" />
        <div class="space-y-2">
          <div
            v-for="capability in plannedCapabilities"
            :key="capability"
            class="rounded-lg border border-surface-300 dark:border-surface-700 px-3 py-2 text-sm leading-6"
          >
            {{ capability }}
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>
