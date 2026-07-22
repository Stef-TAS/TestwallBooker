<script lang="ts">
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import ColumnGroup from 'primevue/columngroup' // optional
import Row from 'primevue/row' // optional
import { ref } from 'vue'

const testwalls = ref([
  { testwallId: 1, testwallName: 'pikatchu', isAvailable: false, user: 'dingus@ttcontrol.com' },
])
</script>
<template>
  <p class="text-2xl">overview</p>
  <p class="text-sm">This is a (somewhat) live view of all currently accessible Testwalls</p>
  <DataTable>
    <Column></Column>
    <Column></Column>
  </DataTable>
</template>
