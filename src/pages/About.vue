<script lang="ts" setup>
import { Card, Divider, Fieldset, Tag } from 'primevue'

const quickFacts = [
  {
    label: 'Main Goal',
    value: 'Coordinate shared testwall access',
    accent: 'bg-cyan-500/10 border-cyan-500/30',
  },
  {
    label: 'Core Stack',
    value: 'Vue + PrimeVue + Tailwind + Express + MySQL',
    accent: 'bg-amber-500/10 border-amber-500/30',
  },
  {
    label: 'Operational Focus',
    value: 'Availability, bookings, command consistency, and traceability',
    accent: 'bg-emerald-500/10 border-emerald-500/30',
  },
]

const userJourney = [
  {
    step: '01',
    title: 'Login and Identity',
    description:
      'Users authenticate and receive profile context including location, timezone, and role-derived permissions.',
  },
  {
    step: '02',
    title: 'Overview and Live Status',
    description:
      'The system computes wall status from active booking windows and status markers like active, crashed, and forcequit.',
  },
  {
    step: '03',
    title: 'Guided Booking Flow',
    description:
      'Users validate account information, select a time range, choose an available testwall, and confirm their booking.',
  },
  {
    step: '04',
    title: 'Pseudo Terminal and Command Catalog',
    description:
      'A searchable command list supports consistent command usage and faster operations for testwall tasks.',
  },
  {
    step: '05',
    title: 'Account and Admin Controls',
    description:
      'Profile updates are user-facing while admin-specific controls unlock additional management capabilities.',
  },
]

const apiDomains = [
  'Authentication and login profile response',
  'Account registration and profile updates',
  'Testwall inventory CRUD operations',
  'Booking CRUD and overlap/availability checks',
  'Access-right assignment and role checks',
  'Operational logs and per-user command history',
]

const operationalValue = [
  'Prevents scheduling collisions through overlap checks',
  'Makes occupancy and ownership visible across teams',
  'Standardizes command workflows with predefined commands',
  'Improves traceability with logs and command history',
  'Reduces idle time and coordination overhead',
]

const implementationNotes = [
  'Password handling is currently basic and marked for secure hashing improvements.',
  'The booking finish/confirmation flow appears partially wired in the current UI.',
  'Terminal behavior is currently pseudo-terminal style, not a direct hardware shell.',
]
</script>
<template>
  <div class="max-w-6xl mx-auto pb-10">
    <Card class="relative overflow-hidden border border-cyan-500/20 shadow-xl mb-6">
      <template #content>
        <div class="absolute -top-24 -right-16 h-48 w-48 rounded-full bg-cyan-500/15 blur-2xl" />
        <div class="absolute -bottom-28 -left-16 h-56 w-56 rounded-full bg-amber-500/15 blur-2xl" />

        <div class="relative z-10">
          <div class="flex flex-wrap items-center gap-2 mb-3">
            <Tag severity="info" value="Internal Platform" />
            <Tag severity="warn" value="Shared Hardware Scheduling" />
            <Tag severity="success" value="Role-Aware Access" />
          </div>

          <h1 class="text-3xl font-semibold tracking-tight">What is the Wall Test Facility?</h1>
          <p class="mt-3 text-sm leading-6 opacity-80 max-w-3xl">
            A centralized internal platform for viewing, booking, and coordinating access to shared
            physical testwalls. It gives teams a reliable source of truth for wall availability,
            ownership, and operational history.
          </p>
        </div>
      </template>
    </Card>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <Card v-for="fact in quickFacts" :key="fact.label" :class="['border shadow-md', fact.accent]">
        <template #content>
          <p class="text-xs uppercase tracking-wider opacity-70 mb-1">{{ fact.label }}</p>
          <p class="text-sm font-medium leading-6">{{ fact.value }}</p>
        </template>
      </Card>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
      <Card class="lg:col-span-2 border shadow-lg">
        <template #content>
          <h2 class="text-xl font-semibold">Purpose</h2>
          <Divider class="my-3" />
          <p class="text-sm leading-6 mb-3">
            The Wall Test Facility reduces conflict around shared hardware by replacing ad-hoc
            coordination with transparent scheduling, visible occupancy, and history-backed
            accountability.
          </p>
          <p class="text-sm leading-6">
            In practice, it combines an availability dashboard, booking management, account and role
            handling, and a command-oriented pseudo terminal in one web application.
          </p>
        </template>
      </Card>

      <Fieldset legend="Access Model" class="border shadow-lg">
        <div class="space-y-3 text-sm">
          <div class="flex items-center justify-between gap-3">
            <span class="font-medium">Admin</span>
            <Tag severity="danger" value="Full Management" />
          </div>
          <div class="flex items-center justify-between gap-3">
            <span class="font-medium">Operator</span>
            <Tag severity="info" value="Book + Operate" />
          </div>
          <div class="flex items-center justify-between gap-3">
            <span class="font-medium">User</span>
            <Tag severity="success" value="Observer" />
          </div>
          <Divider class="my-2" />
          <p class="leading-6 opacity-80">
            UI actions are conditionally enabled from these roles, including booking and terminal
            access.
          </p>
        </div>
      </Fieldset>
    </div>

    <Card class="border shadow-lg mb-6">
      <template #content>
        <h2 class="text-xl font-semibold">Core User Journey</h2>
        <Divider class="my-3" />

        <div class="space-y-3">
          <div v-for="item in userJourney" :key="item.step" class="flex gap-4 rounded-xl p-4">
            <div
              class="h-9 w-9 shrink-0 rounded-lg bg-cyan-500/20 text-cyan-900 dark:text-cyan-200 font-semibold flex items-center justify-center"
            >
              {{ item.step }}
            </div>
            <div>
              <p class="text-sm font-semibold mb-1">{{ item.title }}</p>
              <p class="text-sm leading-6 opacity-80">{{ item.description }}</p>
            </div>
          </div>
        </div>
      </template>
    </Card>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
      <Fieldset legend="Backend and Data Architecture" class="border shadow-lg">
        <p class="text-sm leading-6 mb-3">
          The backend runs on Express with MySQL and initializes data structures for accounts,
          roles, testwalls, bookings, logs, and command history.
        </p>
        <div class="space-y-2">
          <div v-for="domain in apiDomains" :key="domain" class="rounded-lg px-3 py-2 text-sm">
            - {{ domain }}
          </div>
        </div>
      </Fieldset>

      <Fieldset legend="Operational Value" class="border shadow-lg">
        <div class="space-y-2">
          <div
            v-for="value in operationalValue"
            :key="value"
            class="rounded-lg px-3 py-2 text-sm leading-6"
          >
            - {{ value }}
          </div>
        </div>
      </Fieldset>
    </div>

    <Card class="border shadow-lg">
      <template #content>
        <h2 class="text-xl font-semibold">Current Implementation Notes</h2>
        <Divider class="my-3" />
        <p class="text-sm leading-6 mb-3 opacity-90">
          The platform already communicates the core intent well, while a few implementation areas
          are still maturing.
        </p>
        <div class="space-y-2">
          <div
            v-for="note in implementationNotes"
            :key="note"
            class="rounded-lg px-3 py-2 text-sm leading-6"
          >
            - {{ note }}
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>
