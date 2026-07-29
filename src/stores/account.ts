import { ref } from 'vue'
import { defineStore } from 'pinia'
import { getCookie, setCookie, deleteCookie } from './cookiehelper'

export type Account = {
  id: number
  username: string
  email: string
  firstName: string
  lastName: string
  location: string
  timezone: string
  profilePicture?: string | null
  canTestwall: boolean
  isAdmin: boolean
}

type LoginResponseAccount = Account & {
  profilePicture?: string | null
}

export const useAccountStore = defineStore('account', () => {
  //checking if the user is logged in currently

  let rawAccountCookie = ref(getCookie('account'))

  const account = ref<Account | undefined>()
  const loggedIn = ref(false)
  const loginError = ref<string | null>(null)
  const loginLoading = ref(false)
  const showAdminContent = ref(false)

  if (rawAccountCookie.value != undefined) // it is set
  {
    account.value = rawAccountCookie.value as Account
    loggedIn.value = true
    void hydrateAccount()
  }

  async function hydrateAccount() {
    if (!account.value?.id) {
      return
    }

    try {
      const response = await fetch(`/api/accounts/${account.value.id}`)
      if (!response.ok) {
        return
      }

      const data = (await response.json()) as Partial<LoginResponseAccount>
      account.value = {
        ...account.value,
        ...data,
      }
    } catch {
      // Ignore hydration failures and keep the cookie-backed account state.
    }
  }

  function persistAccountToCookie(nextAccount: Account) {
    const { profilePicture: _profilePicture, ...cookieSafeAccount } = nextAccount
    setCookie('account', cookieSafeAccount)
  }

  async function TryLogin(email: string, password: string): Promise<string> {
    loginLoading.value = true
    loginError.value = null

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = (await response.json()) as {
        success?: boolean
        account?: Account
        error?: string
      }

      if (!response.ok || !data.success) {
        loginError.value = data.error || 'Login failed'
        return data.error || 'Login failed'
      }

      // Store account in state and cookie
      account.value = data.account
      loggedIn.value = true
      persistAccountToCookie(data.account!)

      return '' // empty = success
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Network error'
      loginError.value = errorMsg
      return errorMsg
    } finally {
      loginLoading.value = false
    }
  }

  function logout() {
    account.value = undefined
    loggedIn.value = false
    loginError.value = null
    deleteCookie('account')
  }

  return {
    account,
    loggedIn,
    loginError,
    loginLoading,
    showAdminContent,
    TryLogin,
    logout,
    hydrateAccount,
    persistAccountToCookie,
  }
})
