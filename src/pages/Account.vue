<script lang="ts" setup>
import { useAccountStore } from '@/stores/account'
import { useAccounts, type Account as ApiAccount } from '@/composables/useAccounts'
import { useAccessRights, type AccessRight } from '@/composables/useAccessRights'
import FileUpload, { type FileUploadSelectEvent } from 'primevue/fileupload'
import { Card, Divider, ToggleSwitch, Button, InputText, Toast, Tag, Dialog } from 'primevue'
import Fieldset from 'primevue/fieldset'
import Select from 'primevue/select'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref, watch } from 'vue'

const toast = useToast()

const accountStore = useAccountStore()
const {
  registerAccount,
  updateAccount,
  deleteAccount,
  getAllAccounts,
  loading: accountsLoading,
  error: accountsError,
} = useAccounts()
const { getAllAccessRights, assignAccessRight, getUserAccessRights, revokeAccessRight } =
  useAccessRights()

const defaultAvatarUrl = new URL('../data/avatar.png', import.meta.url).href

const DarkMode = ref(false)
const profilePictureSelector = ref<{ clear: () => void } | null>(null)
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

const availablePermissions = ref<AccessRight[]>([])
const selectedPermission = ref<AccessRight | null>(null)

// User management
const allUsers = ref<ApiAccount[]>([])
const userFilters = ref({ global: { value: null as string | null, matchMode: 'contains' } })
const modifyModalVisible = ref(false)
const editingUser = ref<ApiAccount | null>(null)
const editUserPermissions = ref<AccessRight[]>([])
const selectedEditPermission = ref<AccessRight | null>(null)
const editUserForm = ref({ firstName: '', lastName: '', location: '', timezone: '' })

async function loadAllUsers() {
  allUsers.value = await getAllAccounts()
}

async function openModifyModal(user: ApiAccount) {
  editingUser.value = user
  editUserForm.value = {
    firstName: user.firstName ?? '',
    lastName: user.lastName ?? '',
    location: user.location ?? '',
    timezone: user.timezone ?? '',
  }
  editUserPermissions.value = await getUserAccessRights(user.id)
  selectedEditPermission.value = editUserPermissions.value[0] ?? null
  modifyModalVisible.value = true
}

async function handleUpdateUser() {
  if (!editingUser.value) return

  const ok = await updateAccount(
    editingUser.value.id,
    editUserForm.value.firstName,
    editUserForm.value.lastName,
    editUserForm.value.location,
    editUserForm.value.timezone,
  )
  if (!ok) {
    toast.add({
      severity: 'error',
      summary: 'Update Failed',
      detail: accountsError.value || 'Failed to update user',
      life: 5000,
    })
    return
  }

  // Sync permissions: revoke all existing then assign the selected one
  for (const right of editUserPermissions.value) {
    await revokeAccessRight(editingUser.value.id, right.id)
  }
  if (selectedEditPermission.value) {
    await assignAccessRight(editingUser.value.id, selectedEditPermission.value.id)
  }

  toast.add({
    severity: 'success',
    summary: 'User Updated',
    detail: `${editingUser.value.username} has been updated.`,
    life: 4000,
  })
  await loadAllUsers()
}

async function handleDeleteUser() {
  if (!editingUser.value) return
  const ok = await deleteAccount(editingUser.value.id)
  if (ok) {
    toast.add({
      severity: 'success',
      summary: 'User Deleted',
      detail: `${editingUser.value.username} has been deleted.`,
      life: 4000,
    })
    modifyModalVisible.value = false
    await loadAllUsers()
  } else {
    toast.add({
      severity: 'error',
      summary: 'Delete Failed',
      detail: accountsError.value || 'Failed to delete user',
      life: 5000,
    })
  }
}

const currentProfilePicture = computed(() => {
  return profilePicturePreview.value || accountStore.account?.profilePicture || defaultAvatarUrl
})

const profilePictureChooseLabel = computed(() => {
  return profilePictureFile.value?.name || 'Choose profile picture'
})

onMounted(async () => {
  const isDark = document.documentElement.classList.contains('dark')
  DarkMode.value = isDark
  availablePermissions.value = await getAllAccessRights()
  await loadAllUsers()
})

watch(DarkMode, (enabled) => {
  document.documentElement.classList.toggle('dark', enabled)
  localStorage.setItem('theme', enabled ? 'dark' : 'light')
})

async function handleProfilePictureChange(event: FileUploadSelectEvent) {
  const file = event.files?.[0] ?? null

  profilePictureFile.value = file
  profilePicturePreview.value = file ? await fileToDataUrl(file) : null
}

function clearSelectedProfilePicture() {
  profilePictureFile.value = null
  profilePicturePreview.value = null
  profilePictureSelector.value?.clear()
}

async function handleSaveProfilePicture() {
  if (!accountStore.account || !profilePictureFile.value) {
    toast.add({
      severity: 'warn',
      summary: 'No Image',
      detail: 'Choose an image before saving',
      life: 4000,
    })
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
    clearSelectedProfilePicture()
    toast.add({
      severity: 'success',
      summary: 'Picture Updated',
      detail: 'Profile picture saved successfully.',
      life: 4000,
    })
  } else {
    toast.add({
      severity: 'error',
      summary: 'Update Failed',
      detail: accountsError.value || 'Failed to update profile picture',
      life: 5000,
    })
  }
}

async function handleAddUser() {
  if (!newUserForm.value.username || !newUserForm.value.email || !newUserForm.value.password) {
    toast.add({
      severity: 'warn',
      summary: 'Missing Fields',
      detail: 'Username, email, and password are required',
      life: 4000,
    })
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
    if (selectedPermission.value) {
      await assignAccessRight(result.id, selectedPermission.value.id)
    }
    const createdUsername = newUserForm.value.username
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
    selectedPermission.value = null
    await loadAllUsers()
    toast.add({
      severity: 'success',
      summary: 'User Created',
      detail: `${createdUsername} has been created successfully.`,
      life: 4000,
    })
  } else {
    toast.add({
      severity: 'error',
      summary: 'Creation Failed',
      detail: accountsError.value || 'Failed to create user',
      life: 5000,
    })
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

function handleLogout() {
  accountStore.logout()
}
</script>
<template>
  <Toast />
  <Card class="relative overflow-hidden border border-blue-500/20 shadow-xl mb-6">
    <template #content>
      <div class="absolute -top-24 -right-16 h-48 w-48 rounded-full bg-blue-500/15 blur-2xl" />
      <div class="absolute -bottom-28 -left-16 h-56 w-56 rounded-full bg-cyan-500/15 blur-2xl" />

      <div class="relative z-10">
        <div class="flex flex-wrap items-center gap-2 mb-3">
          <Tag severity="info" value="Profile" />
          <Tag severity="success" value="Preferences and Access" />
        </div>

        <h1 class="text-3xl font-semibold tracking-tight">Account</h1>
        <p class="mt-3 text-sm leading-6 opacity-80 max-w-3xl">
          Manage your personal information, profile picture, local UI preferences, and account-level
          controls from one central page.
        </p>
      </div>
    </template>
  </Card>

  <div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Fieldset legend="Account information" class="w-full h-full shadow-lg">
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
      <Fieldset legend="Settings" class="w-full h-full shadow-lg">
        <div class="flex flex-col text-sm p-2">
          <div class="flex flex-col gap-3 items-start">
            <img
              :src="currentProfilePicture"
              alt="profile picture"
              class="rounded-xl shadow-lg h-32 w-32 object-cover"
            />
            <FileUpload
              ref="profilePictureSelector"
              mode="basic"
              name="profilePicture"
              accept="image/*"
              :maxFileSize="2000000"
              :chooseLabel="profilePictureChooseLabel"
              @select="handleProfilePictureChange"
            />
            <span v-if="profilePictureFile" class="text-xs text-muted-color">
              Selected: {{ profilePictureFile.name }}
            </span>
            <div class="flex flex-wrap gap-2">
              <Button
                label="Save profile picture"
                icon="pi pi-image"
                @click="handleSaveProfilePicture"
                :loading="accountsLoading"
              />
              <Button
                v-if="profilePictureFile"
                label="Clear"
                icon="pi pi-times"
                severity="secondary"
                variant="outlined"
                @click="clearSelectedProfilePicture"
              />
            </div>
          </div>
        </div>
        <Divider />
        <div class="flex justify-between mb-1">
          <label for="DarkmodeSwitch" class="text-color">Darkmode</label>
          <ToggleSwitch v-model="DarkMode" inputId="DarkmodeSwitch" />
        </div>
        <div v-if="accountStore.account?.isAdmin" class="flex justify-between">
          <span class="text-color">Admin-Content</span>
          <ToggleSwitch v-model="accountStore.showAdminContent" inputId="AdminContentSwitch" />
        </div>
        <Divider />
        <Button
          label="Logout"
          severity="danger"
          icon="pi pi-sign-out"
          class="w-full mt-2 hover:shadow-red-700 hover:shadow-md"
          @click="handleLogout"
        />
      </Fieldset>
      <!-- Admin Section: Add New User -->
      <Fieldset
        v-if="accountStore.account?.isAdmin && accountStore.showAdminContent"
        legend="Admin: Add New User"
        class="w-full h-full shadow-lg"
      >
        <div class="flex flex-col gap-4 p-2">
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
            <div>
              <label class="block text-sm mb-1">Permission Level</label>
              <Select
                v-model="selectedPermission"
                :options="availablePermissions"
                optionLabel="role_name"
                placeholder="Select permission level"
                class="w-full"
              />
            </div>
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

      <!-- Admin Section: Manage Users -->
      <Fieldset
        v-if="accountStore.account?.isAdmin && accountStore.showAdminContent"
        legend="Admin: Manage Users"
        class="w-full h-full shadow-lg"
      >
        <DataTable
          :value="allUsers"
          paginator
          :rows="10"
          :rowsPerPageOptions="[5, 10, 25]"
          v-model:filters="userFilters"
          :globalFilterFields="['username', 'email', 'firstName', 'lastName']"
          filterDisplay="menu"
          class="w-full"
        >
          <template #header>
            <div class="flex justify-end">
              <InputText
                v-model="userFilters['global'].value"
                placeholder="Search users..."
                class="w-64"
              />
            </div>
          </template>
          <template #empty>No users found.</template>
          <Column field="username" header="Username" sortable />
          <Column field="email" header="Email" sortable />
          <Column header="Name">
            <template #body="{ data }"> {{ data.firstName }} {{ data.lastName }} </template>
          </Column>
          <Column header="Actions" style="width: 6rem">
            <template #body="{ data }">
              <Button size="small" label="Modify" @click="openModifyModal(data)" />
            </template>
          </Column>
        </DataTable>
      </Fieldset>

      <!-- Modify User Dialog -->
      <Dialog
        v-model:visible="modifyModalVisible"
        modal
        header="Modify User"
        class="w-full max-w-lg"
      >
        <div v-if="editingUser" class="flex flex-col gap-4">
          <div class="text-sm opacity-60">
            {{ editingUser.username }} &mdash; {{ editingUser.email }}
          </div>
          <Divider />

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm mb-1">First Name</label>
              <InputText v-model="editUserForm.firstName" class="w-full" />
            </div>
            <div>
              <label class="block text-sm mb-1">Last Name</label>
              <InputText v-model="editUserForm.lastName" class="w-full" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm mb-1">Location</label>
              <InputText v-model="editUserForm.location" class="w-full" />
            </div>
            <div>
              <label class="block text-sm mb-1">Timezone</label>
              <InputText
                v-model="editUserForm.timezone"
                placeholder="e.g., Europe/Vienna"
                class="w-full"
              />
            </div>
          </div>
          <div>
            <label class="block text-sm mb-1">Permission Level</label>
            <Select
              v-model="selectedEditPermission"
              :options="availablePermissions"
              optionLabel="role_name"
              placeholder="No permission"
              showClear
              class="w-full"
            />
          </div>

          <Divider />
          <div class="flex justify-between gap-2">
            <Button
              label="Delete User"
              severity="danger"
              icon="pi pi-trash"
              @click="handleDeleteUser"
              :loading="accountsLoading"
            />
            <div class="flex gap-2">
              <Button label="Cancel" severity="secondary" @click="modifyModalVisible = false" />
              <Button label="Save Changes" @click="handleUpdateUser" :loading="accountsLoading" />
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  </div>
</template>
