<script lang="ts" setup>
import { useAccountStore } from '@/stores/account'
import { useAccounts } from '@/composables/useAccounts'
import { Divider, ToggleSwitch, Button, InputText, Message, Tag } from 'primevue'
import Fieldset from 'primevue/fieldset'
import Select from 'primevue/select'
import { computed, onMounted, ref, watch } from 'vue'

const accountStore = useAccountStore()
const {
  registerAccount,
  updateAccount,
  loading: accountsLoading,
  error: accountsError,
} = useAccounts()

const defaultAvatarUrl = new URL('../data/avatar.png', import.meta.url).href

const DarkMode = ref(false)
const profilePictureFile = ref<File | null>(null)
const profilePicturePreview = ref<string | null>(null)

// Form refs for adding new user
const newUserForm = ref({
  username: '',
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  location: '',
  timezone: '',
})

const formSuccess = ref(false)
const formError = ref<string | null>(null)
const pictureSuccess = ref(false)
const pictureError = ref<string | null>(null)

const currentProfilePicture = computed(() => {
  return profilePicturePreview.value || accountStore.account?.profilePicture || defaultAvatarUrl
})

onMounted(() => {
  const isDark = document.documentElement.classList.contains('dark')
  DarkMode.value = isDark
})

watch(DarkMode, (enabled) => {
  document.documentElement.classList.toggle('dark', enabled)
  localStorage.setItem('theme', enabled ? 'dark' : 'light')
})

async function handleProfilePictureChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null

  profilePictureFile.value = file
  profilePicturePreview.value = file ? await fileToDataUrl(file) : null
}

async function handleSaveProfilePicture() {
  pictureError.value = null
  pictureSuccess.value = false

  if (!accountStore.account || !profilePictureFile.value) {
    pictureError.value = 'Choose an image before saving'
    return
  }

  const updated = await updateAccount(
    accountStore.account.id,
    accountStore.account.firstName,
    accountStore.account.lastName,
    accountStore.account.location,
    accountStore.account.timezone,
    profilePictureFile.value,
  )

  if (updated) {
    accountStore.account.profilePicture = profilePicturePreview.value
    accountStore.persistAccountToCookie(accountStore.account)
    profilePictureFile.value = null
    pictureSuccess.value = true
    setTimeout(() => {
      pictureSuccess.value = false
    }, 3000)
  } else {
    pictureError.value = accountsError.value || 'Failed to update profile picture'
  }
}

async function handleAddUser() {
  formError.value = null
  formSuccess.value = false

  if (!newUserForm.value.username || !newUserForm.value.email || !newUserForm.value.password) {
    formError.value = 'Username, email, and password are required'
    return
  }

  const result = await registerAccount(
    newUserForm.value.username,
    newUserForm.value.email,
    newUserForm.value.password,
    newUserForm.value.firstName,
    newUserForm.value.lastName,
    newUserForm.value.location,
    newUserForm.value.timezone,
  )

  if (result) {
    formSuccess.value = true
    // Reset form
    newUserForm.value = {
      username: '',
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      location: '',
      timezone: '',
    }
    setTimeout(() => {
      formSuccess.value = false
    }, 3000)
  } else {
    formError.value = accountsError.value || 'Failed to create user'
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Failed to read image'))
    reader.readAsDataURL(file)
  })
}
</script>
<template>
  <div class="mb-4">
    <p class="text-2xl">Account</p>
    <p class="text-sm">See all the information about you and your settings.</p>
  </div>

  <div>
    <div class="grid grid-cols-2">
      <Fieldset legend="Account information" class="max-w-4/5 w-full h-min">
        <div class="flex flex-col text-sm p-2">
          <div class="flex justify-between">
            <span class="text-color">Username</span>
            <span class="text-muted-color">{{ accountStore.account?.username }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-color">Email</span>
            <span class="text-muted-color">{{ accountStore.account?.email }}</span>
          </div>
          <Divider />
          <div class="flex justify-between">
            <span class="text-color">First Name</span>
            <span class="text-muted-color">{{ accountStore.account?.firstName }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-color">Last Name</span>
            <span class="text-muted-color">{{ accountStore.account?.lastName }}</span>
          </div>
          <Divider />
          <div class="flex justify-between">
            <span class="text-color">Access Right(s)</span>
            <span class="text-muted-color">
              <Tag v-if="accountStore.account?.isAdmin" severity="danger">Admin</Tag>
              <Tag v-if="accountStore.account?.canTestwall" severity="info">Testwall</Tag>
              <Tag
                v-if="!accountStore.account?.isAdmin && !accountStore.account?.canTestwall"
                severity="success"
                >Observer</Tag
              >
            </span>
          </div>
          <div class="flex justify-between">
            <span class="text-color">Location</span>
            <span class="text-muted-color">{{ accountStore.account?.location }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-color">Timezone</span>
            <span class="text-muted-color">{{ accountStore.account?.timezone }}</span>
          </div>
        </div>
      </Fieldset>
      <Fieldset legend="Settings" class="max-w-4/5 w-full h-min">
        <div class="flex flex-col text-sm p-2">
          <div class="flex flex-col gap-3 items-start">
            <Message v-if="pictureSuccess" severity="success" text="Profile picture updated!" />
            <Message v-if="pictureError" severity="error" :text="pictureError" />
            <img
              :src="currentProfilePicture"
              alt="profile picture"
              class="rounded-xl shadow-lg h-32 w-32 object-cover"
            />
            <input type="file" accept="image/*" @change="handleProfilePictureChange" />
            <Button
              label="Save profile picture"
              icon="pi pi-image"
              @click="handleSaveProfilePicture"
              :loading="accountsLoading"
            />
          </div>
        </div>
        <Divider />
        <div class="flex justify-between mb-1">
          <span class="text-color">Darkmode</span>
          <ToggleSwitch v-model="DarkMode" inputId="DarkmodeSwitch" />
        </div>
        <div v-if="accountStore.account?.isAdmin" class="flex justify-between">
          <span class="text-color">Admin-Content</span>
          <ToggleSwitch v-model="accountStore.showAdminContent" inputId="AdminContentSwitch" />
        </div>
      </Fieldset>
    </div>

    <!-- Admin Section: Add New User -->
    <div v-if="accountStore.account?.isAdmin && accountStore.showAdminContent" class="mt-6">
      <Fieldset legend="Admin: Add New User" class="w-full">
        <div class="flex flex-col gap-4 p-2">
          <Message v-if="formSuccess" severity="success" text="User created successfully!" />
          <Message v-if="formError" severity="error" :text="formError" />

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm mb-1">Username *</label>
              <InputText
                v-model="newUserForm.username"
                placeholder="Enter username"
                class="w-full"
              />
            </div>
            <div>
              <label class="block text-sm mb-1">Email *</label>
              <InputText
                v-model="newUserForm.email"
                type="email"
                placeholder="Enter email"
                class="w-full"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm mb-1">Password *</label>
              <InputText
                v-model="newUserForm.password"
                type="password"
                placeholder="Enter password"
                class="w-full"
              />
            </div>
            <div></div>
          </div>

          <Divider />

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm mb-1">First Name</label>
              <InputText
                v-model="newUserForm.firstName"
                placeholder="Enter first name"
                class="w-full"
              />
            </div>
            <div>
              <label class="block text-sm mb-1">Last Name</label>
              <InputText
                v-model="newUserForm.lastName"
                placeholder="Enter last name"
                class="w-full"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm mb-1">Location</label>
              <InputText
                v-model="newUserForm.location"
                placeholder="Enter location"
                class="w-full"
              />
            </div>
            <div>
              <label class="block text-sm mb-1">Timezone</label>
              <InputText
                v-model="newUserForm.timezone"
                placeholder="e.g., Europe/Vienna"
                class="w-full"
              />
            </div>
          </div>

          <Button
            label="Create User"
            @click="handleAddUser"
            :loading="accountsLoading"
            class="w-full mt-4"
          />
        </div>
      </Fieldset>
    </div>
    <div></div>
  </div>
</template>
