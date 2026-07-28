import { ref } from 'vue'
import { defineStore } from 'pinia'

export type Account = {
  username: string
  email: string
  firstName: string
  lastName: string
  location: string
  timezone: string
  canTestwall: boolean
  isAdmin: boolean
}
