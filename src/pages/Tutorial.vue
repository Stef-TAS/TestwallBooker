<script lang="ts" setup>
import { Button, Card, Divider, Fieldset, Tag } from 'primevue'

const tutorialSteps = [
  {
    step: '01',
    title: 'Check Overview First',
    description:
      'Start in Overview to verify the testwall state before you try to book. Prefer walls marked Available. If a wall is Out of Service, do not plan work on it.',
    tags: ['Availability Check', 'Required First Step'],
  },
  {
    step: '02',
    title: 'Open Booking',
    description:
      'Go to Booking and start the guided flow. If Booking is disabled for your account, you currently do not have testwall access. Contact your admin to request the required permissions.',
    tags: ['Access-Controlled', 'Contact Admin if Disabled'],
  },
  {
    step: '03',
    title: 'Complete the Booking Flow',
    description:
      'Review account details, choose start and end time, select an available wall, and confirm your reservation. Use realistic time windows to avoid scheduling conflicts.',
    tags: ['Stepper Flow', 'Reserve Time Slot'],
  },
  {
    step: '04',
    title: 'Review Booking History',
    description:
      'After booking, review the Booking History section to track status changes such as active, finished, crashed, or forcequit. This is useful for audits and troubleshooting.',
    tags: ['Status Tracking', 'Operational Traceability'],
  },
  {
    step: '05',
    title: 'Use Pseudo Terminal During Active Booking',
    description:
      'When your booking is active and currently running, open Pseudo Terminal to execute commands. Press Ctrl/Cmd + L to open the command palette and quickly find predefined commands.',
    tags: ['Runtime Actions', 'Ctrl/Cmd + L'],
  },
]

const doList = [
  'Always validate wall availability in Overview before booking.',
  'Pick precise start/end times that match your real execution window.',
  'Confirm your selected testwall before finishing the booking flow.',
  'Check Booking History after runs to verify final status.',
  'Use the command palette in Pseudo Terminal for consistent commands.',
]

const avoidList = [
  'Do not attempt to use a wall marked Out of Service.',
  'Do not assume terminal access without an active booking window.',
  'Do not ignore disabled Booking access; contact an admin instead.',
  'Do not skip history review when debugging failed or interrupted sessions.',
]
</script>

<template>
  <div class="max-w-6xl mx-auto pb-10">
    <Card class="relative overflow-hidden border border-blue-500/20 shadow-xl mb-6">
      <template #content>
        <div class="absolute -top-24 -right-16 h-48 w-48 rounded-full bg-blue-500/15 blur-2xl" />
        <div class="absolute -bottom-28 -left-16 h-56 w-56 rounded-full bg-cyan-500/15 blur-2xl" />

        <div class="relative z-10">
          <div class="flex flex-wrap items-center gap-2 mb-3">
            <Tag severity="info" value="User Tutorial" />
            <Tag severity="success" value="Booking Workflow" />
            <Tag severity="warn" value="Terminal Keybind Included" />
          </div>

          <h1 class="text-3xl font-semibold tracking-tight">How to Book and Use a Testwall</h1>
          <p class="mt-3 text-sm leading-6 opacity-80 max-w-3xl">
            Follow this guide in order: Overview, Booking, Booking History, then Pseudo Terminal.
            The sequence prevents conflicts and helps you run commands only when access is active.
          </p>
        </div>
      </template>
    </Card>

    <Card class="shadow-lg mb-6">
      <template #content>
        <h2 class="text-xl font-semibold">Step-by-Step Process</h2>
        <Divider class="my-3" />

        <div class="space-y-3">
          <div v-for="item in tutorialSteps" :key="item.step" class="rounded-xl shadow-lg p-4">
            <div class="flex items-start gap-4">
              <div
                class="h-9 w-9 shrink-0 rounded-lg bg-blue-500/20 text-blue-900 dark:text-blue-200 font-semibold flex items-center justify-center"
              >
                {{ item.step }}
              </div>
              <div class="w-full">
                <div class="flex flex-wrap items-center gap-2 mb-2">
                  <p class="text-sm font-semibold">{{ item.title }}</p>
                  <Tag
                    v-for="label in item.tags"
                    :key="`${item.step}-${label}`"
                    severity="secondary"
                    :value="label"
                    rounded
                  />
                </div>
                <p class="text-sm leading-6 opacity-85">{{ item.description }}</p>
              </div>
            </div>
          </div>
        </div>
      </template>
    </Card>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
      <Fieldset legend="Best Practices" class="border shadow-lg">
        <div class="space-y-2">
          <div
            v-for="item in doList"
            :key="item"
            class="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm leading-6"
          >
            {{ item }}
          </div>
        </div>
      </Fieldset>

      <Fieldset legend="Common Mistakes to Avoid" class="border shadow-lg">
        <div class="space-y-2">
          <div
            v-for="item in avoidList"
            :key="item"
            class="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm leading-6"
          >
            {{ item }}
          </div>
        </div>
      </Fieldset>
    </div>

    <Card class="border border-cyan-500/25 shadow-lg">
      <template #content>
        <h2 class="text-xl font-semibold">Quick Navigation</h2>
        <Divider class="my-3" />
        <div class="flex flex-wrap gap-2">
          <Button severity="secondary" label="Open Overview" @click="$router.push('/overview')" />
          <Button severity="secondary" label="Open Booking" @click="$router.push('/booking')" />
          <Button
            severity="secondary"
            label="Open Pseudo Terminal"
            @click="$router.push('/terminal')"
          />
        </div>
        <p class="text-sm leading-6 mt-4 opacity-80">
          Reminder: In Pseudo Terminal, press <span class="font-semibold">Ctrl/Cmd + L</span> to
          open the command palette.
        </p>
      </template>
    </Card>
  </div>
</template>
