import About from '@/pages/About.vue'
import Agent from '@/pages/Agent.vue'
import AdminGuide from '@/pages/AdminGuide.vue'
import Account from '@/pages/Account.vue'
import Booking from '@/pages/Booking.vue'
import Overview from '@/pages/Overview.vue'
import Query from '@/pages/Query.vue'
import Tutorial from '@/pages/Tutorial.vue'
import { createRouter, createWebHistory } from 'vue-router'
import Waldies from '@/pages/Waldies.vue'
import { getCookie } from '@/stores/cookiehelper'

type AccountCookie = {
  isAdmin?: boolean
  canTestwall?: boolean
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: Overview },
    { path: '/overview', component: Overview },
    { path: '/query', component: Query },
    { path: '/account', component: Account },
    { path: '/booking', component: Booking },
    { path: '/agent', component: Agent, meta: { allowedRoles: ['admin', 'operator'] } },
    { path: '/about', component: About },
    { path: '/admin-guide', component: AdminGuide },
    { path: '/tutorial', component: Tutorial },
    { path: '/waldies', component: Waldies },
  ],
})

router.beforeEach((to) => {
  const allowedRoles = Array.isArray(to.meta.allowedRoles)
    ? (to.meta.allowedRoles as string[])
    : undefined

  if (!allowedRoles || allowedRoles.length === 0) {
    return true
  }

  const cookieValue = getCookie('account')
  if (!cookieValue || typeof cookieValue !== 'object') {
    return '/overview'
  }

  const account = cookieValue as AccountCookie
  const isAdmin = account.isAdmin === true
  const isOperator = account.canTestwall === true

  if (allowedRoles.includes('admin') && isAdmin) {
    return true
  }

  if (allowedRoles.includes('operator') && isOperator) {
    return true
  }

  return '/overview'
})

export default router
