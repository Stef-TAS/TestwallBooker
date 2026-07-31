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
  currentUserId?: number | null
  currentUserProfilePicture?: string | null
}

type OverviewRow = {
  id: number
  name: string
  ip_address: string
  created_at?: string
  current_user_id: number | null
  current_user: string | null
  availability_status: 'available' | 'unavailable' | 'out_of_service'
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
  const isOverviewLoading = ref(false)
  const overviewLoadError = ref('')
  const hasOverviewLoaded = ref(false)
  const isOverviewProfilePicturesLoading = ref(false)
  const overviewRows = ref<TestwallWithAvailability[]>([])

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
        currentUserProfilePicture: null,
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

  function normalizeOverviewRow(row: OverviewRow): TestwallWithAvailability {
    const availabilityStatus = row.availability_status

    return {
      id: row.id,
      name: row.name,
      ip_address: row.ip_address,
      created_at: row.created_at,
      isAvailable: availabilityStatus === 'available',
      availabilityStatus,
      currentUser: row.current_user ?? undefined,
      currentUserId: row.current_user_id,
      currentUserProfilePicture: null,
    }
  }

  async function loadOverview(force = false) {
    if (isOverviewLoading.value) {
      return
    }

    if (hasOverviewLoaded.value && !force) {
      return
    }

    try {
      isOverviewLoading.value = true
      overviewLoadError.value = ''

      const overviewRes = await fetch('/api/testwalls/overview')
      if (!overviewRes.ok) {
        throw new Error(`Failed to fetch overview: ${overviewRes.status}`)
      }

      const rows = (await overviewRes.json()) as OverviewRow[]
      overviewRows.value = rows.map(normalizeOverviewRow)
      hasOverviewLoaded.value = true

      void loadOverviewProfilePictures()
    } catch (error) {
      overviewLoadError.value = error instanceof Error ? error.message : 'Unknown error'
    } finally {
      isOverviewLoading.value = false
    }
  }

  async function loadOverviewProfilePictures() {
    const userIds = Array.from(
      new Set(
        overviewRows.value
          .map((row) => row.currentUserId)
          .filter((id): id is number => typeof id === 'number' && id > 0),
      ),
    )

    if (userIds.length === 0) {
      isOverviewProfilePicturesLoading.value = false
      return
    }

    try {
      isOverviewProfilePicturesLoading.value = true

      const response = await fetch(`/api/accounts/profile-pictures?ids=${userIds.join(',')}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch profile pictures: ${response.status}`)
      }

      const pictureByUserId = (await response.json()) as Record<string, string | null>
      overviewRows.value = overviewRows.value.map((row) => {
        if (!row.currentUserId) {
          return row
        }

        const profilePicture = pictureByUserId[String(row.currentUserId)] ?? null
        return {
          ...row,
          currentUserProfilePicture: profilePicture,
        }
      })
    } catch {
      // Keep overview visible even if avatar hydration fails.
    } finally {
      isOverviewProfilePicturesLoading.value = false
    }
  }

  return {
    testwalls,
    bookings,
    testwallsWithAvailability,
    overviewRows,
    isLoading,
    loadError,
    hasLoaded,
    isOverviewLoading,
    overviewLoadError,
    hasOverviewLoaded,
    isOverviewProfilePicturesLoading,
    loadTestwalls,
    loadOverview,
  }
})
