<script lang="ts" setup>
import { Card, Dialog, ProgressSpinner, Select, Tag } from 'primevue'

import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useTestwallsStore, type TestwallWithAvailability } from '../stores/testwalls'
import { useAccountStore } from '@/stores/account'
import { useSettingsStore } from '@/stores/settings'

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
    <Card class="relative overflow-hidden border border-blue-500/20 shadow-xl mb-6">
      <template #content>
        <div class="absolute -top-24 -right-16 h-48 w-48 rounded-full bg-blue-500/15 blur-2xl" />
        <div class="absolute -bottom-28 -left-16 h-56 w-56 rounded-full bg-cyan-500/15 blur-2xl" />

        <div class="relative z-10">
          <h1 class="text-3xl font-semibold tracking-tight">Waldies view</h1>
          <p class="mt-3 text-sm leading-6 opacity-80 max-w-3xl">
            This is placeholder text for the Waldies banner. Replace this sentence with your final
            description when the feature content is ready.
          </p>
        </div>
      </template>
    </Card>
    <div v-if="accountStore.showAdminContent" class="mb-4">
      <p>Admin Terminal Select</p>
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

    <div v-else class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

    <Dialog v-model:visible="detailsVisible" modal header="Waldie Details" class="w-11/12 md:w-3/5">
      <div v-if="isDetailsLoading" class="py-6 flex justify-center">
        <ProgressSpinner style="width: 2rem; height: 2rem" :strokeWidth="6" />
      </div>
      <p v-else-if="detailsLoadError" class="text-red-600">
        Failed to load details: {{ detailsLoadError }}
      </p>
      <div v-else-if="selectedWaldieDetails" class="grid gap-2 sm:grid-cols-2">
        <p><strong>Waldie ID:</strong> {{ selectedWaldieDetails.wldie_id }}</p>
        <p><strong>Waldie Name:</strong> {{ selectedWaldieDetails.wldie_name }}</p>
        <p><strong>Status:</strong> {{ selectedWaldieDetails.status }}</p>
        <p><strong>Serial Number:</strong> {{ selectedWaldieDetails.dutp_number || '-' }}</p>
        <p><strong>eWald:</strong> {{ selectedWaldieDetails.ewld_name }}</p>
        <p><strong>eWald Channel:</strong> {{ selectedWaldieDetails.ewld_channel }}</p>
        <p><strong>GPIO ID:</strong> {{ selectedWaldieDetails.wldie_gpio_id }}</p>
        <p><strong>Load:</strong> {{ selectedWaldieDetails.wldie_load ?? '-' }}</p>
        <p><strong>Max Short Time:</strong> {{ selectedWaldieDetails.wldie_max_short_time }}</p>
        <p><strong>DUT Pin ID:</strong> {{ selectedWaldieDetails.dutp_id }}</p>
        <p><strong>DUT Pin Name:</strong> {{ selectedWaldieDetails.dutp_name || '-' }}</p>
        <p><strong>DUT ID:</strong> {{ selectedWaldieDetails.dut_id ?? '-' }}</p>
        <p><strong>Testbed Name:</strong> {{ selectedWaldieDetails.dut_name || '-' }}</p>
        <p>
          <strong>Testbed Report Name:</strong> {{ selectedWaldieDetails.dut_report_name || '-' }}
        </p>
        <p><strong>Testbed Object Name:</strong> {{ selectedWaldieDetails.dut_obj_name || '-' }}</p>
        <p><strong>DUT Max Voltage:</strong> {{ selectedWaldieDetails.dut_max_vol ?? '-' }}</p>
        <p>
          <strong>DUT Default Baudrate:</strong>
          {{ selectedWaldieDetails.dut_default_baudrate ?? '-' }}
        </p>
        <p><strong>DUT MAC Address:</strong> {{ selectedWaldieDetails.dut_mac_addr || '-' }}</p>
        <p><strong>Testwall ID:</strong> {{ selectedWaldieDetails.testwall_id }}</p>
        <p><strong>Testwall Name:</strong> {{ selectedWaldieDetails.testwall_name }}</p>
        <p>
          <strong>Testwall External ID:</strong> {{ selectedWaldieDetails.testwall_external_id }}
        </p>
        <p><strong>Testwall IP:</strong> {{ selectedWaldieDetails.testwall_ip_address }}</p>
        <p><strong>Testwall Port:</strong> {{ selectedWaldieDetails.testwall_port }}</p>
        <p>
          <strong>Testwall Jenkins Name:</strong> {{ selectedWaldieDetails.testwall_jenkins_name }}
        </p>
      </div>
    </Dialog>
  </div>
</template>
