<script setup lang="ts">
import { ref } from 'vue'
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
import { Divider } from 'primevue'

const sidebarOpen = ref(true)

const canAccessTerminal = ref(true)
const TerminalToolTip =
  '<div class="font-semibold text-sm">Missing Access</div><div class="opacity-75 text-sm mt-1">You currently have no active Bookings. Please book a Terminal before accessing the Terminal.</div>'
</script>

<template>
  <div>
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
                    <span class="text-xl">Testwall Booker</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarTrigger severity="secondary" target="mainsidebar" :text="true">
                    <SidebarIcon />
                  </SidebarTrigger>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
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
                      <SidebarMenuButton @click="$router.push('/booking')">
                        <Bookmark />
                        <span>Booking</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <div class="flex items-center gap-2 w-full">
                        <SidebarMenuButton
                          @click="$router.push('/terminal')"
                          :disabled="canAccessTerminal == false"
                          class="flex-1"
                        >
                          <Code />
                          <span>Pseudo Terminal</span>
                        </SidebarMenuButton>
                        <Info
                          v-if="canAccessTerminal == false"
                          v-tooltip.top="{ value: TerminalToolTip, escape: false }"
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
            <SidebarFooter>
              <SidebarMenu>
                <SidebarMenuItem>
                  <Divider />
                  <SidebarMenuButton @click="$router.push('/account')">
                    <User />
                    <span>John Doe</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarFooter>
            <SidebarRail />
          </SidebarPanel>
        </SidebarAside>
      </Sidebar>
      <SidebarMain class="m-4">
        <RouterView />
      </SidebarMain>
    </SidebarLayout>
  </div>
</template>
