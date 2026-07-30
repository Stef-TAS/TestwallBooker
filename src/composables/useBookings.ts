import { ref } from 'vue'

export type Booking = {
  id: number
  testwall_id: number
  testwall_name?: string
  user_id: number
  username?: string
  user_email?: string
  from_time: string
  to_time: string
  status: string
  created_at?: string
}

export function useBookings() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function getAllBookings(): Promise<Booking[]> {
    loading.value = true
    error.value = null
    try {
      const res = await fetch('/api/bookings')
      if (!res.ok) throw new Error('Failed to fetch bookings')
      return (await res.json()) as Booking[]
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return []
    } finally {
      loading.value = false
    }
  }

  async function getBookingsByTestwall(testwallId: number): Promise<Booking[]> {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`/api/bookings/testwall/${testwallId}`)
      if (!res.ok) throw new Error('Failed to fetch bookings')
      return (await res.json()) as Booking[]
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return []
    } finally {
      loading.value = false
    }
  }

  async function getBookingsByUser(userId: number): Promise<Booking[]> {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`/api/bookings/user/${userId}`)
      if (!res.ok) throw new Error('Failed to fetch bookings')
      return (await res.json()) as Booking[]
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return []
    } finally {
      loading.value = false
    }
  }

  async function checkAvailability(
    testwallId: number,
    fromTime: string,
    toTime: string,
  ): Promise<boolean> {
    loading.value = true
    error.value = null
    try {
      const res = await fetch('/api/bookings/check-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testwall_id: testwallId,
          from_time: fromTime,
          to_time: toTime,
        }),
      })
      if (!res.ok) throw new Error('Failed to check availability')
      const data = (await res.json()) as { available: boolean }
      return data.available
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return false
    } finally {
      loading.value = false
    }
  }

  async function createBooking(
    testwallId: number,
    userId: number,
    fromTime: string,
    toTime: string,
    status = 'active',
  ): Promise<Booking | null> {
    loading.value = true
    error.value = null
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testwall_id: testwallId,
          user_id: userId,
          from_time: fromTime,
          to_time: toTime,
          status,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create booking')
      }
      return (await res.json()) as Booking
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return null
    } finally {
      loading.value = false
    }
  }

  async function updateBooking(
    id: number,
    fromTime?: string,
    toTime?: string,
    status?: string,
  ): Promise<boolean> {
    loading.value = true
    error.value = null
    try {
      const payload: Record<string, string> = {}
      if (fromTime !== undefined) {
        payload.from_time = fromTime
      }

      if (toTime !== undefined) {
        payload.to_time = toTime
      }

      if (status !== undefined) {
        payload.status = status
      }

      const res = await fetch(`/api/bookings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Failed to update booking')
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return false
    } finally {
      loading.value = false
    }
  }

  async function terminateBooking(id: number): Promise<boolean> {
    return updateBooking(id, undefined, undefined, 'forcequit')
  }

  async function deleteBooking(id: number): Promise<boolean> {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`/api/bookings/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete booking')
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
    getAllBookings,
    getBookingsByTestwall,
    getBookingsByUser,
    checkAvailability,
    createBooking,
    updateBooking,
    terminateBooking,
    deleteBooking,
  }
}
