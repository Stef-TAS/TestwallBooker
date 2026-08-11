import About from '@/pages/About.vue'
import AdminGuide from '@/pages/AdminGuide.vue'
import Account from '@/pages/Account.vue'
import Booking from '@/pages/Booking.vue'
import Overview from '@/pages/Overview.vue'
import Query from '@/pages/Query.vue'
import Tutorial from '@/pages/Tutorial.vue'
import { createRouter, createWebHistory } from 'vue-router'
import Waldies from '@/pages/Waldies.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '', component: Overview },
    { path: '/overview', component: Overview },
    { path: '/query', component: Query },
    { path: '/account', component: Account },
    { path: '/booking', component: Booking },
    { path: '/about', component: About },
    { path: '/admin-guide', component: AdminGuide },
    { path: '/tutorial', component: Tutorial },
    { path: '/waldies', component: Waldies },
  ],
})

export default router
