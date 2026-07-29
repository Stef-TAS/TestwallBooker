<script lang="ts" setup>
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import { onMounted } from 'vue'
import { Button, Tag } from 'primevue'
import { storeToRefs } from 'pinia'
import { useTestwallsStore } from '@/stores/testwalls'
import { useAccountStore } from '@/stores/account'

const testwallsStore = useTestwallsStore()
const { testwallsWithAvailability, isLoading, loadError } = storeToRefs(testwallsStore)
const { loadTestwalls } = testwallsStore

const accountStore = useAccountStore()

onMounted(() => {
  void loadTestwalls()
})
</script>
<template>
  <div class="mb-4">
    <p class="text-2xl">overview</p>
    <p class="text-sm">This is a (somewhat) live view of all currently accessible Testwalls</p>
  </div>
  <div>
    <p v-if="isLoading">Loading data...</p>
    <p v-else-if="loadError">Failed to load data: {{ loadError }}</p>
    <DataTable
      :value="testwallsWithAvailability"
      removableSort
      paginator
      :rows="20"
      :rowsPerPageOptions="[5, 10, 20, 50]"
      stripedRows
      class="shadow-xl"
    >
      <Column field="id" header="ID" sortable />
      <Column field="name" header="Testwall" sortable />
      <Column field="isAvailable" header="Availability" sortable>
        <template #body="{ data }">
          <Tag v-if="data.isAvailable" severity="success">Available</Tag>
          <Tag v-else severity="danger">In Use</Tag>
        </template>
      </Column>
      <Column field="currentUser" header="Current User" sortable>
        <template #body="{ data }">
          <span v-if="data.currentUser">{{ data.currentUser }}</span>
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
