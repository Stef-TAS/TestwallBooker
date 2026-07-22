<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import Sidebar from 'primevue/sidebar'
import SidebarBackdrop from 'primevue/sidebarbackdrop'
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

const isMobile = ref(false)
const sidebarOpen = ref(true)

function syncSidebarMode() {
  isMobile.value = window.matchMedia('(max-width: 768px)').matches
  sidebarOpen.value = !isMobile.value
}

onMounted(() => {
  syncSidebarMode()
  window.addEventListener('resize', syncSidebarMode)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', syncSidebarMode)
})
</script>

<template>
  <div>
    <SidebarLayout>
      <SidebarBackdrop />
      <Sidebar
        id="mainsidebar"
        v-model:open="sidebarOpen"
        :overlay="isMobile"
        :collapsible="isMobile ? 'offcanvas' : 'icon'"
      >
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
                      <SidebarMenuButton @click="$router.push('/terminal')">
                        <Code />
                        <span>Pseudo Terminal</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton @click="$router.push('/query')">
                        <Search />
                        <span>Query</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton>
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
        <SidebarTrigger severity="secondary" target="mainsidebar" :text="true" size="small">
          <SidebarIcon />
        </SidebarTrigger>
        <RouterView />
      </SidebarMain>
    </SidebarLayout>
  </div>
</template>
