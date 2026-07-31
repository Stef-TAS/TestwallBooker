import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export type Testwall = {
  id: number
  name: string
  ip_address: string
  created_at?: string
}

export type TestwallWithAvailability = Testwall & {
  isAvailable: boolean
  availabilityStatus: 'available' | 'unavailable' | 'out_of_service'
  currentUser?: string
}

export type Booking = {
  id: number
  testwall_id: number
  user_id: number
  username?: string
  from_time: string
  to_time: string
  status?: string
}

export const useTestwallsStore = defineStore('testwalls', () => {
  const testwalls = ref<Testwall[]>([])
  const bookings = ref<Booking[]>([])
  const isLoading = ref(false)
  const loadError = ref('')
  const hasLoaded = ref(false)

  // Computed property for testwalls with availability
  const testwallsWithAvailability = computed((): TestwallWithAvailability[] => {
    return testwalls.value.map((testwall) => {
      const now = new Date()
      const currentBookings = bookings.value.filter(
        (booking) =>
          booking.testwall_id === testwall.id &&
          new Date(booking.from_time) <= now &&
          now < new Date(booking.to_time),
      )

      const activeBooking = currentBookings.find(
        (booking) => (booking.status ?? 'active').toLowerCase() === 'active',
      )

      const isOutOfService = false // TODO: add reachability check

      const availabilityStatus: 'available' | 'unavailable' | 'out_of_service' = isOutOfService
        ? 'out_of_service'
        : activeBooking
          ? 'unavailable'
          : 'available'

      return {
        ...testwall,
        isAvailable: availabilityStatus === 'available',
        availabilityStatus,
        currentUser: activeBooking?.username,
      }
    })
  })

  async function loadTestwalls(force = false) {
    if (isLoading.value) {
      return
    }

    if (hasLoaded.value && !force) {
      return
    }

    try {
      isLoading.value = true
      loadError.value = ''

      const [testwallsRes, bookingsRes] = await Promise.all([
        fetch('/api/testwalls'),
        fetch('/api/bookings'),
      ])

      if (!testwallsRes.ok) {
        throw new Error(`Failed to fetch testwalls: ${testwallsRes.status}`)
      }

      if (!bookingsRes.ok) {
        throw new Error(`Failed to fetch bookings: ${bookingsRes.status}`)
      }

      testwalls.value = (await testwallsRes.json()) as Testwall[]
      bookings.value = (await bookingsRes.json()) as Booking[]
      hasLoaded.value = true
    } catch (error) {
      loadError.value = error instanceof Error ? error.message : 'Unknown error'
    } finally {
      isLoading.value = false
    }
  }

  return {
    testwalls,
    bookings,
    testwallsWithAvailability,
    isLoading,
    loadError,
    hasLoaded,
    loadTestwalls,
  }
})
