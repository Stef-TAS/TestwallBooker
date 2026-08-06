<script lang="ts" setup>
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import { onMounted, onUnmounted, ref } from 'vue'
import { Button, Card, Skeleton, Tag } from 'primevue'
import { storeToRefs } from 'pinia'
import { useTestwallsStore } from '@/stores/testwalls'
import { useAccountStore } from '@/stores/account'
import { useSettingsStore } from '@/stores/settings'

const defaultAvatarUrl = new URL('../data/avatar.png', import.meta.url).href

const testwallsStore = useTestwallsStore()
const { overviewRows, isOverviewLoading, overviewLoadError, isOverviewProfilePicturesLoading } =
  storeToRefs(testwallsStore)
const { loadOverview } = testwallsStore

const accountStore = useAccountStore()
const settingsStore = useSettingsStore()

const REFRESH_INTERVAL_MS = 30_000
let refreshTimer: ReturnType<typeof setInterval> | null = null
const autoRefresh = ref(false)

function startRefresh() {
  stopRefresh()
  refreshTimer = setInterval(() => void loadOverview(), REFRESH_INTERVAL_MS)
}

function stopRefresh() {
  if (refreshTimer !== null) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

function toggleAutoRefresh() {
  autoRefresh.value = !autoRefresh.value
  autoRefresh.value ? startRefresh() : stopRefresh()
}

onMounted(() => void loadOverview())
onUnmounted(() => stopRefresh())
</script>
<template>
  <Card class="relative overflow-hidden border border-blue-500/20 shadow-xl mb-6">
    <template #content>
      <div class="absolute -top-24 -right-16 h-48 w-48 rounded-full bg-blue-500/15 blur-2xl" />
      <div class="absolute -bottom-28 -left-16 h-56 w-56 rounded-full bg-cyan-500/15 blur-2xl" />

      <div class="relative z-10">
        <div class="flex flex-wrap items-center gap-2 mb-3">
          <Tag severity="info" value="Live Status" />
          <Tag severity="success" value="Availability Overview" />
        </div>

        <div class="flex items-end justify-between gap-4">
          <div>
            <h1 class="text-3xl font-semibold tracking-tight">Overview</h1>
            <p class="mt-3 text-sm leading-6 opacity-80 max-w-3xl">
              This is a (somewhat) live view of all currently accessible Testwalls, including
              current availability and active occupancy.
            </p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <Button
              :icon="autoRefresh ? 'pi pi-pause' : 'pi pi-refresh'"
              :label="autoRefresh ? 'Auto-refresh on' : 'Auto-refresh off'"
              :severity="autoRefresh ? 'success' : 'secondary'"
              size="small"
              @click="toggleAutoRefresh"
            />
            <Button
              icon="pi pi-refresh"
              label="Refresh"
              size="small"
              severity="secondary"
              :loading="isOverviewLoading"
              @click="() => loadOverview()"
            />
          </div>
        </div>
      </div>
    </template>
  </Card>
  <div class="max-w-full overflow-x-auto">
    <p v-if="isOverviewLoading">Loading data...</p>
    <p v-else-if="overviewLoadError">Failed to load data: {{ overviewLoadError }}</p>
    <DataTable
      :value="overviewRows"
      removableSort
      paginator
      :rows="settingsStore.compactView ? 25 : 20"
      :rowsPerPageOptions="[5, 10, 20, 50]"
      :size="settingsStore.compactView ? 'small' : undefined"
      stripedRows
      class="shadow-xl min-w-max"
    >
      <Column field="id" header="ID" sortable />
      <Column field="name" header="Testwall" sortable />
      <Column field="availabilityStatus" header="Availability" sortable>
        <template #body="{ data }">
          <Tag
            v-if="data.availabilityStatus === 'available'"
            severity="success"
            v-tooltip.top="{
              value:
                '<div class=\'font-semibold text-sm\'>Available</div><div class=\'opacity-75 text-sm mt-1\'>The device is currently <b>online</b> and there is no booking happening at the moment.<br><span class=\'opacity-60\'>Note: this can change.</span></div>',
              escape: false,
            }"
            >Available</Tag
          >
          <Tag
            v-else-if="data.availabilityStatus === 'unavailable'"
            severity="warn"
            v-tooltip.top="{
              value:
                '<div class=\'font-semibold text-sm\'>Unavailable</div><div class=\'opacity-75 text-sm mt-1\'>The device is currently <b>online</b>, but is being used for a test.<br><span class=\'opacity-60\'>If this is wrong, contact the current tester or an admin.</span></div>',
              escape: false,
            }"
            >Unavailable</Tag
          >
          <Tag
            v-else
            severity="danger"
            v-tooltip.top="{
              value:
                '<div class=\'font-semibold text-sm\'>Out of Service</div><div class=\'opacity-75 text-sm mt-1\'>The device is currently being repaired, upgraded, or is in a state that makes it unavailable for access.<br><span class=\'opacity-60\'>If this is wrong, contact an admin.</span></div>',
              escape: false,
            }"
            >Out of Service</Tag
          >
        </template>
      </Column>
      <Column field="currentUser" header="Current User" sortable>
        <template #body="{ data }">
          <div v-if="data.currentUser" class="flex items-center gap-2">
            <Skeleton v-if="isOverviewProfilePicturesLoading" shape="circle" size="1.75rem" />
            <img
              v-else
              :src="data.currentUserProfilePicture || defaultAvatarUrl"
              :alt="`profile picture of ${data.currentUser}`"
              class="h-7 w-7 rounded-full object-cover border border-surface-300"
            />
            <span>{{ data.currentUser }}</span>
          </div>
          <span v-else class="text-muted-color">-</span>
        </template>
      </Column>
      <Column header="Current Machine Users">
        <template #body="{ data }">
          <span v-if="data.currentUsers.length > 0">{{ data.currentUsers.join(', ') }}</span>
          <span v-else class="text-muted-color">-</span>
        </template>
      </Column>
      <Column field="ip_address" header="IP Address" sortable />
      <Column header="Actions" v-if="accountStore.showAdminContent">
        <template #body="{ data }">
          <Button v-if="data.availabilityStatus === 'unavailable'" severity="warning"
            >Terminate</Button
          >
        </template>
      </Column>
    </DataTable>
  </div>
</template>
