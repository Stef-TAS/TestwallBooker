<script lang="ts" setup>
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import { onMounted } from 'vue'
import { Button, Card, Skeleton, Tag } from 'primevue'
import { storeToRefs } from 'pinia'
import { useTestwallsStore } from '@/stores/testwalls'
import { useAccountStore } from '@/stores/account'

const defaultAvatarUrl = new URL('../data/avatar.png', import.meta.url).href

const testwallsStore = useTestwallsStore()
const { overviewRows, isOverviewLoading, overviewLoadError, isOverviewProfilePicturesLoading } =
  storeToRefs(testwallsStore)
const { loadOverview } = testwallsStore

const accountStore = useAccountStore()

onMounted(() => {
  void loadOverview()
})
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

        <h1 class="text-3xl font-semibold tracking-tight">Overview</h1>
        <p class="mt-3 text-sm leading-6 opacity-80 max-w-3xl">
          This is a (somewhat) live view of all currently accessible Testwalls, including current
          availability and active occupancy.
        </p>
      </div>
    </template>
  </Card>
  <div>
    <p v-if="isOverviewLoading">Loading data...</p>
    <p v-else-if="overviewLoadError">Failed to load data: {{ overviewLoadError }}</p>
    <DataTable
      :value="overviewRows"
      removableSort
      paginator
      :rows="20"
      :rowsPerPageOptions="[5, 10, 20, 50]"
      stripedRows
      class="shadow-xl"
    >
      <Column field="id" header="ID" sortable />
      <Column field="name" header="Testwall" sortable />
      <Column field="availabilityStatus" header="Availability" sortable>
        <template #body="{ data }">
          <Tag v-if="data.availabilityStatus === 'available'" severity="success">Available</Tag>
          <Tag v-else-if="data.availabilityStatus === 'unavailable'" severity="warn"
            >Unavailable</Tag
          >
          <Tag v-else severity="danger">Out of Service</Tag>
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
      <Column field="ip_address" header="IP Address" sortable />
      <Column header="Actions" v-if="accountStore.showAdminContent">
        <template #body="{ data }">
          <Button v-if="!data.isAvailable" severity="warning">Terminate</Button>
        </template>
      </Column>
    </DataTable>
  </div>
</template>
