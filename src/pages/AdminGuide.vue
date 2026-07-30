<script lang="ts" setup>
import { computed } from 'vue'
import { Card, Divider, Fieldset, Tag } from 'primevue'
import { useAccountStore } from '@/stores/account'

const accountStore = useAccountStore()
const isAdmin = computed(() => accountStore.account?.isAdmin === true)

const adminAccess = [
  {
    title: 'Admin Controls Toggle',
    details:
      'Admins can enable Admin-Content from the Account page. This unlocks administrator-only controls in the UI.',
    severity: 'danger',
    label: 'Privilege',
  },
  {
    title: 'Create New Users',
    details:
      'From Account > Admin section, admins can create user accounts and define identity profile values such as names, location, and timezone.',
    severity: 'info',
    label: 'Identity Management',
  },
  {
    title: 'Visibility Across Platform',
    details:
      'Admins can inspect wall availability, booking history, and account context to support scheduling decisions and incident response.',
    severity: 'success',
    label: 'Operational Oversight',
  },
]

const adminCanDo = [
  'Toggle admin-only interface content from Account settings',
  'Create new user accounts directly in the application',
  'Review booking status outcomes (active, finished, crashed, forcequit)',
  'Monitor testwall occupancy and current user attribution in Overview',
  'Use pseudo terminal workflows and command catalog tools',
]

const adminWorkflows = [
  {
    step: '01',
    title: 'Enable Admin View',
    body: 'Open Account, activate the Admin-Content toggle, and verify additional controls are visible.',
  },
  {
    step: '02',
    title: 'Manage Accounts',
    body: 'Create user profiles as needed and ensure account data is complete (email, name, location, timezone).',
  },
  {
    step: '03',
    title: 'Monitor Availability and Bookings',
    body: 'Use Overview and Booking screens to monitor occupancy, detect conflicts, and spot out-of-service indicators.',
  },
  {
    step: '04',
    title: 'Guide Operators',
    body: 'Direct teams toward predefined commands and standard booking behavior for consistent execution.',
  },
]

const limitsAndResponsibilities = [
  'Current password validation is basic and should be treated as non-final security behavior.',
  'The terminal is pseudo-terminal style and not a direct remote shell into physical hardware.',
  'Use admin privileges carefully: changes to users and scheduling can impact many teams at once.',
  'When a wall appears unavailable or out of service, verify booking status and history before intervention.',
]
</script>

<template>
  <div class="max-w-6xl mx-auto pb-10">
    <Card class="relative overflow-hidden border border-red-500/20 shadow-xl mb-6">
      <template #content>
        <div class="absolute -top-24 -right-16 h-48 w-48 rounded-full bg-red-500/15 blur-2xl" />
        <div
          class="absolute -bottom-28 -left-16 h-56 w-56 rounded-full bg-orange-500/15 blur-2xl"
        />

        <div class="relative z-10">
          <div class="flex flex-wrap items-center gap-2 mb-3">
            <Tag severity="danger" value="Admin Guide" />
            <Tag severity="warn" value="High Impact Actions" />
            <Tag severity="info" value="Role-Based Responsibilities" />
          </div>

          <h1 class="text-3xl font-semibold tracking-tight">Administrator Guide</h1>
          <p class="mt-3 text-sm leading-6 opacity-80 max-w-3xl">
            This page explains exactly what admin access means in Wall Test Facility, what tools are
            available, and how to use them safely for day-to-day operations.
          </p>
        </div>
      </template>
    </Card>

    <Card v-if="!isAdmin" class="border border-amber-500/30 bg-amber-500/10 shadow-lg mb-6">
      <template #content>
        <h2 class="text-xl font-semibold">Restricted Page</h2>
        <Divider class="my-3" />
        <p class="text-sm leading-6">
          You are currently not signed in with an admin account. This guide is intended for users
          with the <span class="font-semibold">Admin</span> role.
        </p>
      </template>
    </Card>

    <div v-else>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card v-for="item in adminAccess" :key="item.title" class="shadow-md">
          <template #content>
            <div class="flex items-center justify-between gap-2 mb-2">
              <p class="text-sm font-semibold">{{ item.title }}</p>
              <Tag :severity="item.severity as any" :value="item.label" />
            </div>
            <p class="text-sm leading-6 opacity-80">{{ item.details }}</p>
          </template>
        </Card>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <Fieldset legend="What Admins Can Do" class="shadow-lg">
          <div class="space-y-2">
            <div
              v-for="capability in adminCanDo"
              :key="capability"
              class="rounded-lg shadow-md px-3 py-2 text-sm leading-6"
            >
              {{ capability }}
            </div>
          </div>
        </Fieldset>

        <Fieldset legend="Responsibilities and Limits" class="shadow-lg">
          <div class="space-y-2">
            <div
              v-for="item in limitsAndResponsibilities"
              :key="item"
              class="rounded-lg shadow-md px-3 py-2 text-sm leading-6"
            >
              {{ item }}
            </div>
          </div>
        </Fieldset>
      </div>

      <Card class="shadow-lg mb-6">
        <template #content>
          <h2 class="text-xl font-semibold">Recommended Admin Workflow</h2>
          <Divider class="my-3" />

          <div class="space-y-3">
            <div
              v-for="flow in adminWorkflows"
              :key="flow.step"
              class="flex gap-4 rounded-xl shadow-md p-4"
            >
              <div
                class="h-9 w-9 shrink-0 rounded-lg bg-red-500/20 text-red-900 dark:text-red-200 font-semibold flex items-center justify-center"
              >
                {{ flow.step }}
              </div>
              <div>
                <p class="text-sm font-semibold mb-1">{{ flow.title }}</p>
                <p class="text-sm leading-6 opacity-80">{{ flow.body }}</p>
              </div>
            </div>
          </div>
        </template>
      </Card>

      <Card class="border border-cyan-500/25 shadow-lg">
        <template #content>
          <h2 class="text-xl font-semibold">Quick Notes for Effective Administration</h2>
          <Divider class="my-3" />
          <p class="text-sm leading-6 mb-2">
            Admin actions should prioritize platform reliability and clear communication. When
            changing account setup or intervening in bookings, aim for predictable workflows and
            traceable decisions.
          </p>
          <p class="text-sm leading-6 opacity-80">
            The current system already supports strong visibility and coordination. As backend
            security and workflow wiring mature, your role is to keep team usage disciplined and
            consistent.
          </p>
        </template>
      </Card>
    </div>
  </div>
</template>
