import { ref } from 'vue'

export type Account = {
  id: number
  username: string
  email: string
  firstName: string | null
  lastName: string | null
  location: string | null
  timezone: string | null
  profilePicture: string | null
  createdAt: string
}

export function useAccounts() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function getAccount(id: number): Promise<Account | null> {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`/api/accounts/${id}`)
      if (!res.ok) throw new Error('Failed to fetch account')
      return (await res.json()) as Account
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return null
    } finally {
      loading.value = false
    }
  }

  async function getAllAccounts(): Promise<Account[]> {
    loading.value = true
    error.value = null
    try {
      const res = await fetch('/api/accounts')
      if (!res.ok) throw new Error('Failed to fetch accounts')
      return (await res.json()) as Account[]
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return []
    } finally {
      loading.value = false
    }
  }

  async function registerAccount(
    username: string,
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
    location?: string,
    timezone?: string,
  ): Promise<Account | null> {
    loading.value = true
    error.value = null
    try {
      const res = await fetch('/api/accounts/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          email,
          password,
          first_name: firstName,
          last_name: lastName,
          location,
          timezone,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to register')
      }
      return (await res.json()) as Account
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return null
    } finally {
      loading.value = false
    }
  }

  async function updateAccount(
    id: number,
    firstName?: string,
    lastName?: string,
    location?: string,
    timezone?: string,
    profilePicture?: Blob | null,
  ): Promise<boolean> {
    loading.value = true
    error.value = null
    try {
      const payload: Record<string, unknown> = {}

      if (firstName !== undefined) {
        payload.first_name = firstName
      }

      if (lastName !== undefined) {
        payload.last_name = lastName
      }

      if (location !== undefined) {
        payload.location = location
      }

      if (timezone !== undefined) {
        payload.timezone = timezone
      }

      if (profilePicture instanceof Blob) {
        payload.profile_picture = await blobToBase64(profilePicture)
      } else if (profilePicture === null) {
        payload.profile_picture = null
      }

      const res = await fetch(`/api/accounts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Failed to update account')
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return false
    } finally {
      loading.value = false
    }
  }

  async function deleteAccount(id: number): Promise<boolean> {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`/api/accounts/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete account')
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return false
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,
    getAccount,
    getAllAccounts,
    registerAccount,
    updateAccount,
    deleteAccount,
  }
}

// Helper function to convert Blob to Base64
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
