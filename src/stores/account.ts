import { ref } from 'vue'
import { defineStore } from 'pinia'
import { getCookie } from './cookiehelper'

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

export const useAccountStore = defineStore('account', () => {
  //checking if the user is logged in currently

  let rawAccountCookie = ref(getCookie('account'))

  const account = ref<Account | undefined>()
  const loggedIn = ref(false)

  if (rawAccountCookie.value != undefined) // it is set
  {
    account.value = rawAccountCookie.value as Account
    loggedIn.value = true
  }

  async function TryLogin(email: string, password: string) {
    //do server shenanigans

    return 'Something failed'
  }

  return { account, loggedIn, TryLogin }
})
