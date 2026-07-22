<script lang="ts" setup>
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import { ref, onMounted } from 'vue'
import { Tag } from 'primevue'

type Testwall = {
  testwallId: number
  testwallName: string
  isAvailable: boolean
  user: string
}

const testwalls = ref<Testwall[]>([])
const isLoading = ref(true)
const loadError = ref('')
const testwallsFileUrl = new URL('../data/testwalls.json', import.meta.url).href

async function loadTestwalls() {
  try {
    isLoading.value = true
    loadError.value = ''

    const response = await fetch(testwallsFileUrl)
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`)
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      throw new Error('Data file did not return JSON content')
    }

    const data = (await response.json()) as Testwall[]
    testwalls.value = data
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'Unknown error'
  } finally {
    isLoading.value = false
  }
}

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
      :rows="10"
      :rowsPerPageOptions="[5, 10, 20, 50]"
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
    </DataTable>
  </div>
</template>
