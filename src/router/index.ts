import Account from '@/pages/Account.vue'
import Booking from '@/pages/Booking.vue'
import Overview from '@/pages/Overview.vue'
import Query from '@/pages/Query.vue'
import Terminal from '@/pages/Terminal.vue'
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '', component: Overview },
    { path: '/overview', component: Overview },
    { path: '/terminal', component: Terminal },
    { path: '/query', component: Query },
    { path: '/account', component: Account },
    { path: '/booking', component: Booking },
  ],
})

export default router
