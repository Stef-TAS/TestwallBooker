<script lang="ts" setup>
import { Divider, ToggleSwitch } from 'primevue'
import Fieldset from 'primevue/fieldset'
import Select from 'primevue/select'
import { onMounted, ref, watch } from 'vue'

const DarkMode = ref(false)
const AdminContent = ref(false)

onMounted(() => {
  const isDark = document.documentElement.classList.contains('dark')
  DarkMode.value = isDark
})

watch(DarkMode, (enabled) => {
  document.documentElement.classList.toggle('dark', enabled)
  localStorage.setItem('theme', enabled ? 'dark' : 'light')
})
</script>
<template>
  <div class="mb-4">
    <p class="text-2xl">Account</p>
    <p class="text-sm">See all the information about you and your settings.</p>
  </div>

  <div>
    <div class="grid grid-cols-2">
      <Fieldset legend="Account information" class="max-w-4/5 w-full">
        <div class="flex flex-col text-sm p-2">
          <div class="flex justify-between">
            <span class="text-color">Username</span>
            <span class="text-muted-color">Dingus</span>
          </div>
          <div class="flex justify-between">
            <span class="text-color">Email</span>
            <span class="text-muted-color">dingus@ttcontrol.com</span>
          </div>
          <Divider />
          <div class="flex justify-between">
            <span class="text-color">First Name</span>
            <span class="text-muted-color">Dingus</span>
          </div>
          <div class="flex justify-between">
            <span class="text-color">Last Name</span>
            <span class="text-muted-color">Bingus</span>
          </div>
          <Divider />
          <div class="flex justify-between">
            <span class="text-color">Access Right(s)</span>
            <span class="text-muted-color">Testwall, Query, Admin</span>
          </div>
          <div class="flex justify-between">
            <span class="text-color">Location</span>
            <span class="text-muted-color">TTControl GmbH, AUT, Wien</span>
          </div>
          <div class="flex justify-between">
            <span class="text-color">Timezone</span>
            <span class="text-muted-color">Europe/Vienna</span>
          </div>
        </div>
      </Fieldset>
      <Fieldset legend="Settings" class="max-w-4/5 w-full">
        <div class="flex flex-col text-sm p-2">
          <div class="flex justify-between">
            <img src="" alt="profile picture" />
          </div>
        </div>
        <Divider />
        <div class="flex justify-between mb-1">
          <span class="text-color">Darkmode</span>
          <ToggleSwitch v-model="DarkMode" inputId="DarkmodeSwitch" />
        </div>
        <div class="flex justify-between">
          <span class="text-color">Admin-Content</span>
          <ToggleSwitch v-model="AdminContent" inputId="AdminContentSwitch" />
        </div>
      </Fieldset>
    </div>
  </div>
</template>
