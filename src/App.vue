<script setup lang="ts">
import { computed, ref } from 'vue'
import Sidebar from 'primevue/sidebar'
import SidebarAside from 'primevue/sidebaraside'
import SidebarContent from 'primevue/sidebarcontent'
import SidebarFooter from 'primevue/sidebarfooter'
import SidebarGroup from 'primevue/sidebargroup'
import SidebarGroupAction from 'primevue/sidebargroupaction'
import SidebarGroupContent from 'primevue/sidebargroupcontent'
import SidebarGroupLabel from 'primevue/sidebargrouplabel'
import SidebarHeader from 'primevue/sidebarheader'
import SidebarMain from 'primevue/sidebarmain'
import SidebarLayout from 'primevue/sidebarlayout'
import SidebarMenu from 'primevue/sidebarmenu'
import SidebarMenuAction from 'primevue/sidebarmenuaction'
import SidebarMenuBadge from 'primevue/sidebarmenubadge'
import SidebarMenuButton from 'primevue/sidebarmenubutton'
import SidebarMenuItem from 'primevue/sidebarmenuitem'
import SidebarMenuSub from 'primevue/sidebarmenusub'
import SidebarMenuSubButton from 'primevue/sidebarmenusubbutton'
import SidebarMenuSubItem from 'primevue/sidebarmenusubitem'
import SidebarPanel from 'primevue/sidebarpanel'
import SidebarRail from 'primevue/sidebarrail'
import SidebarSpacer from 'primevue/sidebarspacer'
import SidebarTrigger from 'primevue/sidebartrigger'
import SidebarIcon from '@primeicons/vue/sidebar'
import Home from '@primeicons/vue/home'
import Code from '@primeicons/vue/code'
import Search from '@primeicons/vue/search'
import Warehouse from '@primeicons/vue/warehouse'
import User from '@primeicons/vue/user'
import Info from '@primeicons/vue/info-circle'
import Bookmark from '@primeicons/vue/bookmark'
import Eye from '@primeicons/vue/eye'
import EyeSlash from '@primeicons/vue/eye-slash'
import Question from '@primeicons/vue/question-circle'
import Map from '@primeicons/vue/map'
import { Card, Divider, FloatLabel, InputPassword, InputText, InputIcon, Button } from 'primevue'
import { useAccountStore } from './stores/account'
import { storeToRefs } from 'pinia'

const accountStore = useAccountStore()
const defaultAvatarUrl = new URL('./data/avatar.png', import.meta.url).href

const sidebarProfilePicture = computed(() => {
  return accountStore.account?.profilePicture || defaultAvatarUrl
})

const AccountEmail = ref('')
const AccountPassword = ref('')

const loginStatus = ref('')

async function login() {
  loginStatus.value = await accountStore.TryLogin(AccountEmail.value, AccountPassword.value)
}

const mask = ref(true)

const sidebarOpen = ref(true)
const linksMenuOpen = ref(false)

const quickLinks = [
  { label: 'phpMyAdmin', href: 'http://c-l-twc-001/phpmyadmin/' },
  { label: 'Testwall API Docs', href: 'http://c-l-twc-001/tw_api/html/testwall-docs/index.html' },
  { label: 'PrimeVue Docs', href: 'https://primevue.org' },
  { label: 'Vite Docs', href: 'https://vite.dev/guide/' },
]

function openQuickLink(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
  linksMenuOpen.value = false
}

const canAccessTerminal = ref(true)
const TerminalToolTip =
  '<div class="font-semibold text-sm">Missing Access</div><div class="opacity-75 text-sm mt-1">You currently have no active Bookings. Please book a Terminal before accessing the Terminal.</div>'

const NoTestWallAccessToolTip =
  '<div class="font-semibold text-sm">Missing Access</div><div class="opacity-75 text-sm mt-1">You currently have no access to the Testwall, meaning you can only see the Status of the Testwalls. If this is incorrect, contact an Admin or your supervisor.</div>'
</script>

<template>
  <div class="quick-links-panel" @mouseleave="linksMenuOpen = false">
    <Transition name="quick-links-menu">
      <div v-if="linksMenuOpen" class="quick-links-dropdown">
        <Button
          v-for="link in quickLinks"
          :key="link.href"
          class="quick-link-button"
          severity="secondary"
          outlined
          @click="openQuickLink(link.href)"
        >
          {{ link.label }}
        </Button>
      </div>
    </Transition>
    <Button
      class="quick-links-toggle"
      severity="contrast"
      :label="linksMenuOpen ? 'Close Links' : 'Open Links'"
      icon="pi pi-external-link"
      @click="linksMenuOpen = !linksMenuOpen"
    />
  </div>
  <div v-if="accountStore.loggedIn">
    <SidebarLayout>
      <Sidebar id="mainsidebar" v-model:open="sidebarOpen" :overlay="false" collapsible="icon">
        <SidebarSpacer />
        <SidebarAside>
          <SidebarPanel>
            <SidebarHeader>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton @click="$router.push('/overview')">
                    <Warehouse />
                    <span class="text-xl"> &nbsp Wall Test Facility</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarTrigger severity="secondary" target="mainsidebar" :text="true">
                    <SidebarIcon />
                    <span class="sidebar-trigger-label">&nbsp Collapse Sidebar</span>
                  </SidebarTrigger>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel>General Info</SidebarGroupLabel>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton @click="$router.push('/about')">
                      <Question />
                      <span>About</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton @click="$router.push('/tutorial')">
                      <Map />
                      <span>Tutorial</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem v-if="accountStore.account?.isAdmin">
                    <SidebarMenuButton @click="$router.push('/admin-guide')">
                      <User />
                      <span>Admin Guide</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton @click="$router.push('/account')">
                      <img
                        :src="sidebarProfilePicture"
                        alt="profile picture"
                        class="h-7 w-7 rounded-full object-cover border border-surface-300"
                      />
                      <span>
                        {{ accountStore.account?.firstName }}
                        {{ accountStore.account?.lastName }}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroup>
              <SidebarGroup>
                <SidebarGroupLabel>Actions</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton @click="$router.push('/overview')">
                        <Home />
                        <span>Overview</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <div class="flex items-center gap-2 w-full">
                        <SidebarMenuButton
                          @click="$router.push('/booking')"
                          :disabled="accountStore.account?.canTestwall == false"
                        >
                          <Bookmark />
                          <span>Booking</span>
                        </SidebarMenuButton>
                        <Info
                          v-if="accountStore.account?.canTestwall == false"
                          v-tooltip.top="{ value: NoTestWallAccessToolTip, escape: false }"
                        />
                      </div>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <div class="flex items-center gap-2 w-full">
                        <SidebarMenuButton
                          @click="$router.push('/waldies')"
                          :disabled="
                            canAccessTerminal == false || accountStore.account?.canTestwall == false
                          "
                          class="flex-1"
                        >
                          <Code />
                          <span>Waldies</span>
                        </SidebarMenuButton>
                        <Info
                          v-if="canAccessTerminal == false"
                          v-tooltip.top="{ value: TerminalToolTip, escape: false }"
                        />
                        <Info
                          v-if="accountStore.account?.canTestwall == false"
                          v-tooltip.top="{ value: NoTestWallAccessToolTip, escape: false }"
                        />
                      </div>
                    </SidebarMenuItem>
                    <!--
                      <SidebarMenuItem>
                        <SidebarMenuButton @click="$router.push('/query')">
                          <Search />
                          <span>Query</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      -->
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
            <SidebarRail />
          </SidebarPanel>
        </SidebarAside>
      </Sidebar>
      <SidebarMain class="m-4">
        <RouterView />
      </SidebarMain>
    </SidebarLayout>
  </div>
  <div v-else class="login-screen flex items-center justify-center h-screen">
    <Card class="w-full max-w-sm">
      <template #content>
        <p class="text-4xl text-blue-600 dark:text-sky-400">Wall Test Facility</p>
        <p class="opacity-50">The internal booking system for all currently available Testwalls</p>
        <Divider class="mb-8">Login</Divider>
        <div>
          <FloatLabel class="mb-8">
            <InputText id="account_Email" v-model="AccountEmail" class="w-full" />
            <label for="account_Email">Email</label>
          </FloatLabel>
          <FloatLabel>
            <div class="relative mb-8">
              <InputPassword
                id="account_Password"
                v-model="AccountPassword"
                class="w-full"
                :mask="mask"
              />
              <InputIcon
                class="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2"
                @click="mask = !mask"
              >
                <Eye v-if="mask" />
                <EyeSlash v-else />
              </InputIcon>
            </div>
            <label for="account_Email">Password</label>
          </FloatLabel>
          <Button
            class="w-full"
            :disabled="AccountEmail.length == 0 || AccountPassword.length == 0"
            @click="login"
            >Login</Button
          >
          <span class="text-red-400 block text-center mt-2">{{ loginStatus }}</span>
        </div>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.login-screen {
  background-image: url('./themes/login_background.png');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.sidebar-trigger-label {
  display: inline-block;
  overflow: hidden;
  white-space: nowrap;
  max-width: 12rem;
  opacity: 1;
  margin-left: 0.25rem;
  transition:
    max-width 180ms ease,
    opacity 120ms ease,
    margin-left 180ms ease;
}

#mainsidebar[data-state='collapsed'] .sidebar-trigger-label {
  max-width: 0;
  opacity: 0;
  margin-left: 0;
  pointer-events: none;
}

.quick-links-panel {
  position: fixed;
  left: 1rem;
  bottom: 1rem;
  z-index: 1200;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
}

.quick-links-dropdown {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: var(--p-surface-0);
  border: 1px solid var(--p-surface-200);
  border-radius: 0.75rem;
  box-shadow: 0 10px 24px rgb(0 0 0 / 0.16);
  padding: 0.625rem;
  min-width: 11rem;
}

.dark .quick-links-dropdown {
  background: var(--p-surface-900);
  border-color: var(--p-surface-700);
}

.quick-link-button {
  width: 100%;
  justify-content: flex-start;
}

.quick-links-toggle {
  box-shadow: 0 8px 18px rgb(0 0 0 / 0.2);
}

.quick-links-menu-enter-active,
.quick-links-menu-leave-active {
  transition: all 180ms ease;
}

.quick-links-menu-enter-from,
.quick-links-menu-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.96);
}

@media (max-width: 640px) {
  .quick-links-panel {
    left: 0.75rem;
    bottom: 0.75rem;
  }

  .quick-links-dropdown {
    min-width: 9.5rem;
  }
}
</style>
