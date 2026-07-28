<script lang="ts" setup>
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import { onMounted } from 'vue'
import { Button, Tag } from 'primevue'
import { storeToRefs } from 'pinia'
import { useTestwallsStore } from '../stores/testwalls'
import { useAccountStore } from '@/stores/account'

const testwallsStore = useTestwallsStore()
const { testwalls, isLoading, loadError } = storeToRefs(testwallsStore)
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
      :value="testwalls"
      removableSort
      paginator
      :rows="20"
      :rowsPerPageOptions="[5, 10, 20, 50]"
      stripedRows
      class="shadow-xl"
    >
      <Column field="testwallId" header="id" sortable />
      <Column field="testwallName" header="Testwall" sortable />
      <Column field="isAvailable" header="Availability" sortable>
        <template #body="{ data }">
          <Tag v-if="data.isAvailable == true" severity="success">Yes</Tag>
          <Tag v-if="data.isAvailable == false" severity="danger">No</Tag>
        </template>
      </Column>
      <Column field="user" header="User" sortable />
      <Column field="ipAddress" header="IP" sortable />
      <Column filed="" header="Actions" v-if="accountStore.account?.isAdmin">
        <template #body="{ data }">
          <Button v-if="data.isAvailable == false">Terminate</Button>
        </template>
      </Column>
    </DataTable>
  </div>
</template>
