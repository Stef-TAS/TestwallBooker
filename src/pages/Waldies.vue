<script lang="ts" setup>
import { Card, Select, Tag } from 'primevue'

import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useTestwallsStore } from '../stores/testwalls'
import { useAccountStore } from '@/stores/account'
import { useSettingsStore } from '@/stores/settings'

const accountStore = useAccountStore()
const settingsStore = useSettingsStore()

const testwallsStore = useTestwallsStore()
const { testwallsWithAvailability } = storeToRefs(testwallsStore)
const { loadTestwalls } = testwallsStore

onMounted(() => {
  void loadTestwalls()
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
    <div></div>
  </div>
</template>
