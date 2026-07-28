import { ref } from 'vue'

export type AccessRight = {
  id: number
  role_name: string
  description?: string
}

export function useAccessRights() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function getAllAccessRights(): Promise<AccessRight[]> {
    loading.value = true
    error.value = null
    try {
      const res = await fetch('/api/access-rights')
      if (!res.ok) throw new Error('Failed to fetch access rights')
      return (await res.json()) as AccessRight[]
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return []
    } finally {
      loading.value = false
    }
  }

  async function getUserAccessRights(userId: number): Promise<AccessRight[]> {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`/api/access-rights/user/${userId}`)
      if (!res.ok) throw new Error('Failed to fetch user access rights')
      return (await res.json()) as AccessRight[]
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return []
    } finally {
      loading.value = false
    }
  }

  async function assignAccessRight(userId: number, accessRightId: number): Promise<boolean> {
    loading.value = true
    error.value = null
    try {
      const res = await fetch('/api/access-rights/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, access_right_id: accessRightId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to assign access right')
      }
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return false
    } finally {
      loading.value = false
    }
  }

  async function revokeAccessRight(userId: number, accessRightId: number): Promise<boolean> {
    loading.value = true
    error.value = null
    try {
      const res = await fetch('/api/access-rights/revoke', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, access_right_id: accessRightId }),
      })
      if (!res.ok) throw new Error('Failed to revoke access right')
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return false
    } finally {
      loading.value = false
    }
  }

  async function checkUserRole(userId: number, roleName: string): Promise<boolean> {
    loading.value = true
    error.value = null
    try {
      const res = await fetch('/api/access-rights/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, role_name: roleName }),
      })
      if (!res.ok) throw new Error('Failed to check user role')
      const data = (await res.json()) as { hasRole: boolean }
      return data.hasRole
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
    getAllAccessRights,
    getUserAccessRights,
    assignAccessRight,
    revokeAccessRight,
    checkUserRole,
  }
}
