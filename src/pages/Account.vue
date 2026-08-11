<script lang="ts" setup>
import { useAccountStore } from '@/stores/account'
import { useSettingsStore } from '@/stores/settings'
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
const settingsStore = useSettingsStore()
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

const themes = [
  { id: 'light', label: 'Light', accent: '#6366f1', dark: false },
  { id: 'dark', label: 'Dark', accent: '#000000', dark: true },
  { id: 'ocean', label: 'Ocean', accent: '#14b8a6', dark: true },
  { id: 'crimson', label: 'Crimson', accent: '#ef4444', dark: false },
  { id: 'hm', label: 'HM OS', accent: '#d946ef', dark: false },
  { id: 'highcontrast', label: 'High Contrast', accent: '#facc15', dark: true },
]

type ThemeId = 'light' | 'dark' | 'ocean' | 'crimson' | 'hm' | 'highcontrast'
const activeTheme = ref<ThemeId>((localStorage.getItem('theme') as ThemeId) ?? 'light')

function applyTheme(id: ThemeId) {
  const theme = themes.find((t) => t.id === id)!
  document.documentElement.classList.toggle('dark', theme.dark)
  document.documentElement.setAttribute('data-theme', id)
  localStorage.setItem('theme', id)
  activeTheme.value = id
}

const fu = ref<{ clear: () => void; choose: () => void } | null>(null)
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

type ServiceStatus = {
  running: boolean
  error?: string
}

const serverStatusLoading = ref(false)
const serverStatusError = ref<string | null>(null)
const databaseStatus = ref<ServiceStatus | null>(null)
const pythonStatus = ref<ServiceStatus | null>(null)
const statusCheckedAt = ref<string | null>(null)

async function loadSystemStatus() {
  if (!accountStore.account?.isAdmin) {
    return
  }

  serverStatusLoading.value = true
  serverStatusError.value = null

  try {
    const res = await fetch('/api/system/status')
    if (!res.ok) {
      throw new Error(`Status request failed (${res.status})`)
    }

    const data = (await res.json()) as {
      database?: ServiceStatus
      python?: ServiceStatus
      checkedAt?: string
    }

    databaseStatus.value = data.database ?? null
    pythonStatus.value = data.python ?? null
    statusCheckedAt.value = data.checkedAt ?? null
  } catch (error) {
    serverStatusError.value =
      error instanceof Error ? error.message : 'Failed to load server status'
    databaseStatus.value = null
    pythonStatus.value = null
    statusCheckedAt.value = null
  } finally {
    serverStatusLoading.value = false
  }
}

const databaseTagSeverity = computed(() => {
  if (!databaseStatus.value) return 'secondary'
  return databaseStatus.value.running ? 'success' : 'danger'
})

const pythonTagSeverity = computed(() => {
  if (!pythonStatus.value) return 'secondary'
  return pythonStatus.value.running ? 'success' : 'danger'
})

const formattedStatusCheckedAt = computed(() => {
  if (!statusCheckedAt.value) return ''
  const parsed = new Date(statusCheckedAt.value)
  if (Number.isNaN(parsed.getTime())) return statusCheckedAt.value
  return parsed.toLocaleString()
})

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

onMounted(async () => {
  await loadSystemStatus()

  if (accountStore.account?.isAdmin) {
    availablePermissions.value = await getAllAccessRights()
    await loadAllUsers()
  }
})

async function handleProfilePictureChange(event: FileUploadSelectEvent) {
  const file = event.files?.[0] ?? null

  profilePictureFile.value = file
  profilePicturePreview.value = file ? await fileToDataUrl(file) : null
}

function clearSelectedProfilePicture() {
  profilePictureFile.value = null
  profilePicturePreview.value = null
  fu.value?.clear()
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

function onChoose() {
  fu.value?.choose()
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
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

  <div :class="{ 'compact-page': settingsStore.compactView }">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
      <Fieldset legend="Account information" class="w-full shadow-lg">
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
              <Tag
                v-if="accountStore.account?.isAdmin"
                severity="danger"
                v-tooltip.left="{
                  value:
                    '<div class=\'font-semibold text-sm\'>Admin</div><div class=\'opacity-75 text-sm mt-1\'>Full platform control. Can manage user accounts and permissions, terminate any active booking, view booking history for all users, and toggle admin-only UI content from Account settings.</div>',
                  escape: false,
                }"
                >Admin</Tag
              >
              <Tag
                v-if="accountStore.account?.canTestwall"
                severity="info"
                v-tooltip.left="{
                  value:
                    '<div class=\'font-semibold text-sm\'>Testwall Operator</div><div class=\'opacity-75 text-sm mt-1\'>Can book testwalls, review availability and occupancy details, and use Waldies for mapped hardware context.</div>',
                  escape: false,
                }"
                >Testwall</Tag
              >
              <Tag
                v-if="!accountStore.account?.isAdmin && !accountStore.account?.canTestwall"
                severity="success"
                v-tooltip.left="{
                  value:
                    '<div class=\'font-semibold text-sm\'>Observer</div><div class=\'opacity-75 text-sm mt-1\'>Read-only access. Can view Overview and testwall availability, but cannot create bookings. Contact an Admin to request elevated permissions.</div>',
                  escape: false,
                }"
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

          <template v-if="accountStore.account?.isAdmin && accountStore.showAdminContent">
            <Divider />
            <p class="text-xs font-semibold uppercase tracking-wider text-muted-color mb-1">
              Server Status
            </p>
            <p class="text-sm text-muted-color">Status is loaded once when this page opens.</p>

            <div class="grid grid-cols-1 gap-3">
              <div class="flex items-center justify-between rounded-lg border px-3 py-2">
                <span class="flex items-center gap-2 text-sm font-medium">
                  <i class="pi pi-database server-status-icon server-status-icon-mysql" />
                  <span>Database Server</span>
                </span>
                <Tag :severity="databaseTagSeverity">
                  {{
                    serverStatusLoading
                      ? 'Checking...'
                      : databaseStatus?.running
                        ? 'Running'
                        : 'Down'
                  }}
                </Tag>
              </div>

              <p
                v-if="
                  !serverStatusLoading &&
                  databaseStatus &&
                  !databaseStatus.running &&
                  databaseStatus.error
                "
                class="text-xs text-red-400"
              >
                Database error: {{ databaseStatus.error }}
              </p>

              <div class="flex items-center justify-between rounded-lg border px-3 py-2">
                <span class="flex items-center gap-2 text-sm font-medium">
                  <i class="pi pi-code server-status-icon server-status-icon-python" />
                  <span>Python Server</span>
                </span>
                <Tag :severity="pythonTagSeverity">
                  {{
                    serverStatusLoading ? 'Checking...' : pythonStatus?.running ? 'Running' : 'Down'
                  }}
                </Tag>
              </div>

              <div
                v-if="
                  !serverStatusLoading &&
                  pythonStatus &&
                  !pythonStatus.running &&
                  pythonStatus.error
                "
                class="flex flex-col gap-1"
              >
                <span class="text-xs text-red-400">Python error:</span>
                <InputText
                  :value="pythonStatus.error"
                  readonly
                  class="text-xs font-mono w-full"
                  :pt="{ root: { class: 'text-red-400! border-red-500/30!' } }"
                />
              </div>
            </div>

            <p v-if="serverStatusError" class="text-xs text-red-400">
              Could not fetch status: {{ serverStatusError }}
            </p>

            <p v-if="formattedStatusCheckedAt" class="text-xs text-muted-color">
              Checked at: {{ formattedStatusCheckedAt }}
            </p>
          </template>
        </div>
      </Fieldset>
      <Fieldset legend="Settings" class="w-full h-full shadow-lg">
        <div class="flex flex-col text-sm p-2">
          <div class="flex flex-col sm:flex-row items-start gap-4">
            <div class="profile-preview-wrapper group w-full sm:w-2/5 aspect-square shrink-0">
              <img
                :src="currentProfilePicture"
                alt="profile picture"
                class="profile-preview-image"
              />
              <div class="profile-preview-overlay" aria-hidden="true">
                <div class="profile-preview-cutout" />
              </div>
            </div>
            <div class="flex flex-col gap-2 flex-1">
              <FileUpload
                ref="fu"
                name="profilePicture"
                accept="image/*"
                :maxFileSize="2000000"
                mode="advanced"
                :showUploadButton="false"
                :pt="{ root: { class: 'border-0!' }, header: { class: 'hidden!' } }"
                @select="handleProfilePictureChange"
                @clear="clearSelectedProfilePicture"
              >
                <template
                  #content="{
                    files,
                    uploadedFiles,
                    removeFileCallback,
                    removeUploadedFileCallback,
                  }"
                >
                  <div
                    v-if="uploadedFiles?.length > 0 || files?.length > 0"
                    class="flex flex-col gap-2"
                  >
                    <div
                      v-for="(file, i) of uploadedFiles"
                      :key="file.name + file.type + file.size"
                      class="flex items-center gap-3 px-3 py-2 rounded-md bg-surface-50 dark:bg-surface-800"
                    >
                      <i class="pi pi-file text-primary shrink-0" />
                      <div class="flex-1 min-w-0">
                        <div class="text-sm truncate">{{ file.name }}</div>
                        <div class="flex items-center gap-1 text-xs">
                          <span class="text-muted-color tabular-nums">{{
                            formatSize(file.size)
                          }}</span>
                          <span class="text-muted-color">·</span>
                          <span class="text-emerald-500">Completed</span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        icon="pi pi-times"
                        text
                        severity="secondary"
                        size="small"
                        rounded
                        @click="removeUploadedFileCallback(i)"
                      />
                    </div>
                    <div
                      v-for="(file, i) of files"
                      :key="file.name + file.type + file.size"
                      class="flex items-center gap-3 px-3 py-2 rounded-md bg-surface-50 dark:bg-surface-800"
                    >
                      <i class="pi pi-file text-primary shrink-0" />
                      <div class="flex-1 min-w-0">
                        <div class="text-sm truncate">{{ file.name }}</div>
                        <div class="flex items-center gap-1 text-xs">
                          <span class="text-muted-color tabular-nums">{{
                            formatSize(file.size)
                          }}</span>
                          <span class="text-muted-color">·</span>
                          <span class="text-primary">Pending</span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        icon="pi pi-times"
                        text
                        severity="secondary"
                        size="small"
                        rounded
                        @click="removeFileCallback(i)"
                      />
                    </div>
                  </div>
                </template>
                <template #empty>
                  <div
                    class="flex flex-col items-center gap-2 py-6 px-4 cursor-pointer rounded-xl border-2 border-dashed border-gray-400/60 shadow-md"
                    @click="onChoose"
                  >
                    <i class="pi pi-cloud-upload text-4xl text-muted-color" />
                    <div class="text-sm font-medium">Drop files or click to browse</div>
                    <div class="text-xs text-muted-color">Up to 2 MB</div>
                  </div>
                </template>
              </FileUpload>
              <Button
                label="Save profile picture"
                icon="pi pi-image"
                @click="handleSaveProfilePicture"
                :loading="accountsLoading"
              />
            </div>
          </div>
        </div>
        <Divider />
        <div class="flex flex-col gap-2">
          <p class="text-xs font-semibold uppercase tracking-wider text-muted-color mb-1">
            Appearance
          </p>
          <div class="flex justify-between items-center">
            <label class="text-color">Theme</label>
            <Select
              :modelValue="activeTheme"
              :options="themes"
              optionLabel="label"
              optionValue="id"
              class="w-40"
              @update:modelValue="applyTheme"
            >
              <template #value="{ value }">
                <div class="flex items-center gap-2">
                  <span
                    class="h-3 w-3 rounded-full shrink-0 ring-1 ring-black/10"
                    :style="{ background: themes.find((t) => t.id === value)?.accent }"
                  />
                  <span>{{ themes.find((t) => t.id === value)?.label }}</span>
                </div>
              </template>
              <template #option="{ option }">
                <div class="flex items-center gap-2">
                  <span
                    class="h-3 w-3 rounded-full shrink-0 ring-1 ring-black/10"
                    :style="{ background: option.accent }"
                  />
                  <span>{{ option.label }}</span>
                </div>
              </template>
            </Select>
          </div>
          <div class="flex justify-between items-center">
            <label for="CompactViewSwitch" class="text-color">Compact view</label>
            <ToggleSwitch v-model="settingsStore.compactView" inputId="CompactViewSwitch" />
          </div>
        </div>
        <Divider />
        <div class="flex flex-col gap-2">
          <p class="text-xs font-semibold uppercase tracking-wider text-muted-color mb-1">
            Display
          </p>
          <div class="flex justify-between items-center">
            <label for="Use24HourSwitch" class="text-color">24-hour time</label>
            <ToggleSwitch v-model="settingsStore.use24HourTime" inputId="Use24HourSwitch" />
          </div>
        </div>
        <div v-if="accountStore.account?.isAdmin" class="flex flex-col gap-2 mt-2">
          <Divider />
          <p class="text-xs font-semibold uppercase tracking-wider text-muted-color mb-1">Admin</p>
          <div class="flex justify-between items-center">
            <label for="AdminContentSwitch" class="text-color">Show admin content</label>
            <ToggleSwitch v-model="accountStore.showAdminContent" inputId="AdminContentSwitch" />
          </div>
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
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        <div class="max-w-full overflow-x-auto">
          <DataTable
            :value="allUsers"
            paginator
            :rows="settingsStore.compactView ? 15 : 10"
            :rowsPerPageOptions="[5, 10, 25]"
            :size="settingsStore.compactView ? 'small' : undefined"
            v-model:filters="userFilters"
            :globalFilterFields="['username', 'email', 'firstName', 'lastName']"
            filterDisplay="menu"
            class="w-full min-w-max"
          >
            <template #header>
              <div class="flex justify-end">
                <InputText
                  v-model="userFilters['global'].value"
                  placeholder="Search users..."
                  class="w-full max-w-64"
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
        </div>
      </Fieldset>

      <!-- Modify User Dialog -->
      <Dialog
        v-model:visible="modifyModalVisible"
        modal
        header="Modify User"
        class="w-[42rem] max-w-[96vw]"
        :breakpoints="{ '960px': '92vw', '640px': '96vw' }"
      >
        <div v-if="editingUser" class="flex flex-col gap-4">
          <div class="text-sm opacity-60">
            {{ editingUser.username }} &mdash; {{ editingUser.email }}
          </div>
          <Divider />

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm mb-1">First Name</label>
              <InputText v-model="editUserForm.firstName" class="w-full" />
            </div>
            <div>
              <label class="block text-sm mb-1">Last Name</label>
              <InputText v-model="editUserForm.lastName" class="w-full" />
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <div class="flex flex-col sm:flex-row sm:justify-between gap-2">
            <Button
              label="Delete User"
              severity="danger"
              icon="pi pi-trash"
              @click="handleDeleteUser"
              :loading="accountsLoading"
            />
            <div class="flex flex-col sm:flex-row gap-2">
              <Button label="Cancel" severity="secondary" @click="modifyModalVisible = false" />
              <Button label="Save Changes" @click="handleUpdateUser" :loading="accountsLoading" />
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  </div>
</template>

<style scoped>
.server-status-icon {
  font-size: 1rem;
}

.server-status-icon-mysql {
  color: #f59e0b;
}

.server-status-icon-python {
  color: #3b82f6;
}

.profile-preview-wrapper {
  position: relative;
  overflow: hidden;
  border-radius: 0.75rem;
  box-shadow: var(--p-card-shadow);
}

.profile-preview-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.profile-preview-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
  background: rgba(15, 23, 42, 0.16);
}

.profile-preview-cutout {
  width: 76%;
  height: 76%;
  border-radius: 9999px;
  border: 2px dashed rgba(255, 255, 255, 0.85);
  box-shadow:
    0 0 0 999px rgba(17, 24, 39, 0.42),
    0 0 36px 10px rgba(17, 24, 39, 0.35),
    0 0 0 1px rgba(0, 0, 0, 0.2);
}

.group:hover .profile-preview-overlay {
  opacity: 1;
}
</style>
