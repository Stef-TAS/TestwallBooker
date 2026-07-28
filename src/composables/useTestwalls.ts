import { ref } from 'vue'

export type Testwall = {
  id: number
  name: string
  ip_address: string
  created_at: string
}

export function useTestwalls() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function getTestwall(id: number): Promise<Testwall | null> {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`/api/testwalls/${id}`)
      if (!res.ok) throw new Error('Failed to fetch testwall')
      return (await res.json()) as Testwall
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return null
    } finally {
      loading.value = false
    }
  }

  async function getAllTestwalls(): Promise<Testwall[]> {
    loading.value = true
    error.value = null
    try {
      const res = await fetch('/api/testwalls')
      if (!res.ok) throw new Error('Failed to fetch testwalls')
      return (await res.json()) as Testwall[]
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return []
    } finally {
      loading.value = false
    }
  }

  async function createTestwall(name: string, ipAddress: string): Promise<Testwall | null> {
    loading.value = true
    error.value = null
    try {
      const res = await fetch('/api/testwalls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, ip_address: ipAddress }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create testwall')
      }
      return (await res.json()) as Testwall
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return null
    } finally {
      loading.value = false
    }
  }

  async function updateTestwall(id: number, name: string, ipAddress: string): Promise<boolean> {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`/api/testwalls/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, ip_address: ipAddress }),
      })
      if (!res.ok) throw new Error('Failed to update testwall')
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return false
    } finally {
      loading.value = false
    }
  }

  async function deleteTestwall(id: number): Promise<boolean> {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`/api/testwalls/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete testwall')
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
    getTestwall,
    getAllTestwalls,
    createTestwall,
    updateTestwall,
    deleteTestwall,
  }
}
