<script lang="ts" setup>
import { Button, Card, Dialog, ProgressSpinner, Select, Tag, Toast } from 'primevue'
import { useToast } from 'primevue/usetoast'

import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useTestwallsStore, type TestwallWithAvailability } from '../stores/testwalls'
import { useAccountStore } from '@/stores/account'
import { useSettingsStore } from '@/stores/settings'
import { writeToClipboard } from '@/utils/clipboard'

type WaldieStatus = 'active' | 'inactive' | 'unknown'

type WaldieListItem = {
  id: number
  name: string
  serial_number: string | null
  status: WaldieStatus
  ewald_name: string | null
  testbed_name: string | null
}

type WaldieDetails = {
  testwall_id: number
  testwall_name: string
  testwall_external_id: string
  testwall_ip_address: string
  testwall_jenkins_name: string
  testwall_port: string
  ewld_id: number
  ewld_name: string
  ewld_channel: string
  wldie_id: number
  wldie_name: string
  dutp_id: number
  wldie_gpio_id: number
  wldie_load: number | null
  wldie_max_short_time: number
  dutp_name: string | null
  dutp_number: string | null
  dut_id: number | null
  dut_name: string | null
  dut_report_name: string | null
  dut_obj_name: string | null
  dut_default_baudrate: number | null
  dut_mac_addr: string | null
  dut_max_vol: number | null
  status: WaldieStatus
}

const accountStore = useAccountStore()
const settingsStore = useSettingsStore()
const toast = useToast()

const testwallsStore = useTestwallsStore()
const { testwallsWithAvailability } = storeToRefs(testwallsStore)
const { loadTestwalls } = testwallsStore

const selectedTestwall = ref<TestwallWithAvailability | null>(null)
const isWaldiesLoading = ref(false)
const waldiesLoadError = ref('')
const waldies = ref<WaldieListItem[]>([])

const detailsVisible = ref(false)
const isDetailsLoading = ref(false)
const detailsLoadError = ref('')
const selectedWaldieDetails = ref<WaldieDetails | null>(null)

const canShowGrid = computed(() => selectedTestwall.value !== null)

function normalizeStatus(value: unknown): WaldieStatus {
  if (value === 'active' || value === 'inactive') {
    return value
  }
  return 'unknown'
}

function statusSeverity(status: WaldieStatus): 'success' | 'danger' | 'contrast' {
  if (status === 'active') {
    return 'success'
  }

  if (status === 'inactive') {
    return 'danger'
  }

  return 'contrast'
}

function isAdminUser(): boolean {
  return Boolean(accountStore.account?.isAdmin || accountStore.showAdminContent)
}

function escapeSqlString(value: string): string {
  return value.replaceAll("'", "''")
}

function sqlString(value: string | null | undefined): string {
  if (value === null || value === undefined || value.trim() === '') {
    return 'NULL'
  }

  return `'${escapeSqlString(value)}'`
}

function sqlNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? 'NULL' : String(value)
}

function buildWaldieText(details: WaldieDetails): string {
  const lines = [
    'Waldie',
    `ID: ${details.wldie_id}`,
    `Name: ${details.wldie_name}`,
    `Status: ${details.status}`,
    `GPIO ID: ${details.wldie_gpio_id}`,
    `Load: ${details.wldie_load ?? '-'}`,
    `Max Short Time: ${details.wldie_max_short_time}`,
    `DUT Pin ID: ${details.dutp_id}`,
    `DUT Pin Name: ${details.dutp_name || '-'}`,
    `Serial Number: ${details.dutp_number || '-'}`,
  ]

  if (isAdminUser()) {
    lines.push('')
    lines.push('-- SQL (ewald_waldies)')
    lines.push(
      `UPDATE ewald_waldies SET wldie_name = ${sqlString(details.wldie_name)}, ewld_id = ${details.ewld_id}, dutp_id = ${details.dutp_id}, wldie_gpio_id = ${details.wldie_gpio_id}, wldie_load = ${sqlNumber(details.wldie_load)}, wldie_max_short_time = ${details.wldie_max_short_time} WHERE wldie_id = ${details.wldie_id};`,
    )
  }

  return lines.join('\n')
}

function buildEwaldText(details: WaldieDetails): string {
  const lines = [
    'eWald',
    `ID: ${details.ewld_id}`,
    `Name: ${details.ewld_name}`,
    `Channel: ${details.ewld_channel}`,
  ]

  if (isAdminUser()) {
    lines.push('')
    lines.push('-- SQL (ewalds)')
    lines.push(
      `UPDATE ewalds SET ewld_name = ${sqlString(details.ewld_name)}, ewld_channel = ${sqlString(details.ewld_channel)}, l_id = ${details.testwall_id} WHERE ewld_id = ${details.ewld_id};`,
    )
  }

  return lines.join('\n')
}

function buildTestbedText(details: WaldieDetails): string {
  const lines = [
    'Testbed',
    `DUT ID: ${details.dut_id ?? '-'}`,
    `Name: ${details.dut_name || '-'}`,
    `Report Name: ${details.dut_report_name || '-'}`,
    `Object Name: ${details.dut_obj_name || '-'}`,
    `Max Voltage: ${details.dut_max_vol ?? '-'}`,
    `Default Baudrate: ${details.dut_default_baudrate ?? '-'}`,
    `MAC Address: ${details.dut_mac_addr || '-'}`,
  ]

  if (isAdminUser() && details.dut_id !== null) {
    lines.push('')
    lines.push('-- SQL (duts)')
    lines.push(
      `UPDATE duts SET dut_name = ${sqlString(details.dut_name)}, dut_report_name = ${sqlString(details.dut_report_name)}, dut_obj_name = ${sqlString(details.dut_obj_name)}, dut_default_baudrate = ${sqlNumber(details.dut_default_baudrate)}, dut_mac_addr = ${sqlString(details.dut_mac_addr)}, dut_max_vol = ${sqlNumber(details.dut_max_vol)} WHERE dut_id = ${details.dut_id};`,
    )
  }

  return lines.join('\n')
}

function buildTestwallText(details: WaldieDetails): string {
  const lines = [
    'Testwall',
    `ID: ${details.testwall_id}`,
    `Name: ${details.testwall_name}`,
    `External ID: ${details.testwall_external_id}`,
    `IP: ${details.testwall_ip_address}`,
    `Port: ${details.testwall_port}`,
    `Jenkins Name: ${details.testwall_jenkins_name}`,
  ]

  if (isAdminUser()) {
    lines.push('')
    lines.push('-- SQL (testwalls)')
    lines.push(
      `UPDATE testwalls SET name = ${sqlString(details.testwall_name)}, ip_address = ${sqlString(details.testwall_ip_address)}, external_id = ${sqlString(details.testwall_external_id)}, jenkins_name = ${sqlString(details.testwall_jenkins_name)}, port = ${sqlString(details.testwall_port)} WHERE id = ${details.testwall_id};`,
    )
  }

  return lines.join('\n')
}

async function copyText(text: string, successSummary: string) {
  try {
    await writeToClipboard(text)
    toast.add({
      severity: 'success',
      summary: successSummary,
      detail: 'Copied to clipboard.',
      life: 2500,
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Copy failed',
      detail: error instanceof Error ? error.message : 'Unknown error',
      life: 4000,
    })
  }
}

type DetailSection = 'waldie' | 'ewald' | 'testbed' | 'testwall'

async function copyDetailsSection(section: DetailSection) {
  const details = selectedWaldieDetails.value
  if (!details) {
    return
  }

  if (section === 'waldie') {
    await copyText(buildWaldieText(details), 'Waldie info copied')
    return
  }

  if (section === 'ewald') {
    await copyText(buildEwaldText(details), 'eWald info copied')
    return
  }

  if (section === 'testbed') {
    await copyText(buildTestbedText(details), 'Testbed info copied')
    return
  }

  await copyText(buildTestwallText(details), 'Testwall info copied')
}

async function copyAllDetails() {
  const details = selectedWaldieDetails.value
  if (!details) {
    return
  }

  const payload = [
    buildWaldieText(details),
    buildEwaldText(details),
    buildTestbedText(details),
    buildTestwallText(details),
  ].join('\n\n')

  await copyText(payload, 'All details copied')
}

async function loadWaldiesForSelectedTestwall() {
  const testwallId = selectedTestwall.value?.id
  if (!testwallId) {
    waldies.value = []
    return
  }

  try {
    isWaldiesLoading.value = true
    waldiesLoadError.value = ''

    const response = await fetch(`/api/testwalls/${testwallId}/waldies`)
    if (!response.ok) {
      throw new Error(`Failed to fetch waldies: ${response.status}`)
    }

    const payload = (await response.json()) as Array<Record<string, unknown>>
    waldies.value = payload.map((row) => ({
      id: Number(row.id ?? 0),
      name: String(row.name ?? '-'),
      serial_number: row.serial_number === null ? null : String(row.serial_number ?? ''),
      status: normalizeStatus(row.status),
      ewald_name: row.ewald_name === null ? null : String(row.ewald_name ?? ''),
      testbed_name: row.testbed_name === null ? null : String(row.testbed_name ?? ''),
    }))
  } catch (error) {
    waldiesLoadError.value = error instanceof Error ? error.message : 'Unknown error'
    waldies.value = []
  } finally {
    isWaldiesLoading.value = false
  }
}

async function openWaldieDetails(waldieId: number) {
  const testwallId = selectedTestwall.value?.id
  if (!testwallId) {
    return
  }

  detailsVisible.value = true
  selectedWaldieDetails.value = null
  detailsLoadError.value = ''

  try {
    isDetailsLoading.value = true
    const response = await fetch(`/api/testwalls/${testwallId}/waldies/${waldieId}`)
    if (!response.ok) {
      throw new Error(`Failed to fetch waldie details: ${response.status}`)
    }

    const payload = (await response.json()) as WaldieDetails
    selectedWaldieDetails.value = {
      ...payload,
      status: normalizeStatus(payload.status),
    }
  } catch (error) {
    detailsLoadError.value = error instanceof Error ? error.message : 'Unknown error'
  } finally {
    isDetailsLoading.value = false
  }
}

watch(
  () => selectedTestwall.value?.id,
  () => {
    void loadWaldiesForSelectedTestwall()
  },
)

onMounted(() => {
  void loadTestwalls().then(() => {
    const firstTestwall = testwallsWithAvailability.value[0]
    if (!selectedTestwall.value && firstTestwall) {
      selectedTestwall.value = firstTestwall
    }
  })
})
</script>
<template>
  <div :class="{ 'compact-page': settingsStore.compactView }">
    <Toast />
    <Card class="relative overflow-hidden border border-blue-500/20 shadow-xl mb-6">
      <template #content>
        <div class="absolute -top-24 -right-16 h-48 w-48 rounded-full bg-blue-500/15 blur-2xl" />
        <div class="absolute -bottom-28 -left-16 h-56 w-56 rounded-full bg-cyan-500/15 blur-2xl" />

        <div class="relative z-10">
          <div class="flex flex-wrap items-center gap-2 mb-3">
            <Tag severity="info" value="Waldies Grid" />
            <Tag severity="success" value="Copy Ready" />
          </div>
          <h1 class="text-3xl font-semibold tracking-tight">Waldies View</h1>
          <p class="mt-3 text-sm leading-6 opacity-80 max-w-3xl">
            Select a testwall to browse its mapped waldies, inspect status and serial information,
            and open segmented detail cards with quick copy actions for each section or the full
            data set.
          </p>
        </div>
      </template>
    </Card>
    <div v-if="accountStore.showAdminContent" class="mb-4">
      <p>Admin Testwall Selector</p>
      <Select
        v-model="selectedTestwall"
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

    <div v-if="!canShowGrid" class="opacity-75">Select a testwall to display its waldies.</div>

    <div v-else-if="isWaldiesLoading" class="py-6 flex justify-center">
      <ProgressSpinner style="width: 2rem; height: 2rem" :strokeWidth="6" />
    </div>

    <div v-else-if="waldiesLoadError" class="text-red-600">
      Failed to load waldies: {{ waldiesLoadError }}
    </div>

    <div v-else-if="waldies.length === 0" class="opacity-75">
      No waldies found for this testwall.
    </div>

    <div v-else class="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <Card
        v-for="waldie in waldies"
        :key="waldie.id"
        class="transition-transform hover:scale-[1.02] cursor-pointer"
        v-tooltip.top="'View me!'"
        @click="openWaldieDetails(waldie.id)"
      >
        <template #content>
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="font-semibold">{{ waldie.name }}</h3>
              <p class="text-sm opacity-80">Serial: {{ waldie.serial_number || '-' }}</p>
            </div>
            <Tag :severity="statusSeverity(waldie.status)" :value="waldie.status" />
          </div>
        </template>
      </Card>
    </div>

    <Dialog
      v-model:visible="detailsVisible"
      modal
      header="Waldie Details"
      class="w-11/12 md:w-4/5 lg:w-3/4"
    >
      <div v-if="isDetailsLoading" class="py-6 flex justify-center">
        <ProgressSpinner style="width: 2rem; height: 2rem" :strokeWidth="6" />
      </div>
      <p v-else-if="detailsLoadError" class="text-red-600">
        Failed to load details: {{ detailsLoadError }}
      </p>
      <div v-else-if="selectedWaldieDetails" class="space-y-4">
        <div class="flex items-center justify-between gap-3 border-b border-surface-200 pb-3">
          <div>
            <h3 class="text-lg font-semibold">{{ selectedWaldieDetails.wldie_name }}</h3>
            <p class="text-sm opacity-80">Serial: {{ selectedWaldieDetails.dutp_number || '-' }}</p>
          </div>
          <div class="flex items-center gap-2">
            <Tag
              :severity="statusSeverity(selectedWaldieDetails.status)"
              :value="selectedWaldieDetails.status"
            />
            <Button
              label="Copy all"
              icon="pi pi-copy"
              size="small"
              severity="secondary"
              @click="copyAllDetails"
            />
          </div>
        </div>

        <div class="grid gap-3 md:grid-cols-2">
          <Card
            class="cursor-pointer transition-transform hover:scale-[1.02]"
            v-tooltip.top="'Click to copy Waldie info'"
            @click="copyDetailsSection('waldie')"
          >
            <template #content>
              <h4 class="font-semibold mb-2">Waldie</h4>
              <div class="grid gap-1 text-sm">
                <p><strong>ID:</strong> {{ selectedWaldieDetails.wldie_id }}</p>
                <p><strong>GPIO ID:</strong> {{ selectedWaldieDetails.wldie_gpio_id }}</p>
                <p><strong>Load:</strong> {{ selectedWaldieDetails.wldie_load ?? '-' }}</p>
                <p>
                  <strong>Max Short Time:</strong> {{ selectedWaldieDetails.wldie_max_short_time }}
                </p>
                <p><strong>DUT Pin ID:</strong> {{ selectedWaldieDetails.dutp_id }}</p>
                <p><strong>DUT Pin Name:</strong> {{ selectedWaldieDetails.dutp_name || '-' }}</p>
              </div>
            </template>
          </Card>

          <Card
            class="cursor-pointer transition-transform hover:scale-[1.02]"
            v-tooltip.top="'Click to copy eWald info'"
            @click="copyDetailsSection('ewald')"
          >
            <template #content>
              <h4 class="font-semibold mb-2">eWald</h4>
              <div class="grid gap-1 text-sm">
                <p><strong>ID:</strong> {{ selectedWaldieDetails.ewld_id }}</p>
                <p><strong>Name:</strong> {{ selectedWaldieDetails.ewld_name }}</p>
                <p><strong>Channel:</strong> {{ selectedWaldieDetails.ewld_channel }}</p>
              </div>
            </template>
          </Card>

          <Card
            class="cursor-pointer transition-transform hover:scale-[1.02]"
            v-tooltip.top="'Click to copy Testbed info'"
            @click="copyDetailsSection('testbed')"
          >
            <template #content>
              <h4 class="font-semibold mb-2">Testbed</h4>
              <div class="grid gap-1 text-sm">
                <p><strong>DUT ID:</strong> {{ selectedWaldieDetails.dut_id ?? '-' }}</p>
                <p><strong>Name:</strong> {{ selectedWaldieDetails.dut_name || '-' }}</p>
                <p>
                  <strong>Report Name:</strong> {{ selectedWaldieDetails.dut_report_name || '-' }}
                </p>
                <p><strong>Object Name:</strong> {{ selectedWaldieDetails.dut_obj_name || '-' }}</p>
                <p><strong>Max Voltage:</strong> {{ selectedWaldieDetails.dut_max_vol ?? '-' }}</p>
                <p>
                  <strong>Default Baudrate:</strong>
                  {{ selectedWaldieDetails.dut_default_baudrate ?? '-' }}
                </p>
                <p><strong>MAC Address:</strong> {{ selectedWaldieDetails.dut_mac_addr || '-' }}</p>
              </div>
            </template>
          </Card>

          <Card
            class="cursor-pointer transition-transform hover:scale-[1.02]"
            v-tooltip.top="'Click to copy Testwall info'"
            @click="copyDetailsSection('testwall')"
          >
            <template #content>
              <h4 class="font-semibold mb-2">Testwall</h4>
              <div class="grid gap-1 text-sm">
                <p><strong>ID:</strong> {{ selectedWaldieDetails.testwall_id }}</p>
                <p><strong>Name:</strong> {{ selectedWaldieDetails.testwall_name }}</p>
                <p>
                  <strong>External ID:</strong> {{ selectedWaldieDetails.testwall_external_id }}
                </p>
                <p><strong>IP:</strong> {{ selectedWaldieDetails.testwall_ip_address }}</p>
                <p><strong>Port:</strong> {{ selectedWaldieDetails.testwall_port }}</p>
                <p>
                  <strong>Jenkins Name:</strong> {{ selectedWaldieDetails.testwall_jenkins_name }}
                </p>
              </div>
            </template>
          </Card>
        </div>
      </div>
    </Dialog>
  </div>
</template>
