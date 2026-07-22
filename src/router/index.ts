import Overview from '@/pages/Overview.vue'
import Query from '@/pages/Query.vue'
import Terminal from '@/pages/Terminal.vue'
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/overview', component: Overview },
    { path: '/terminal', component: Terminal },
    { path: '/query', component: Query },
  ],
})

export default router
