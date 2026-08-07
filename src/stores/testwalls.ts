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
  currentUsers: string[]
  currentUsersWithProfiles: Array<{ name: string; profilePicture: string | null }>
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
  current_users?: string[]
  availability_status: 'available' | 'unavailable' | 'out_of_service'
}

type ProfilePictureLookupResponse = {
  byId?: Record<string, string | null>
  byUsername?: Record<string, string | null>
}

function buildUsernameLookupKeys(value: string): string[] {
  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return []
  }

  const keys = new Set<string>([normalized])
  const slashParts = normalized.split(/\\|\//).filter(Boolean)
  const lastSlashPart = slashParts.at(-1)
  if (slashParts.length > 1 && lastSlashPart) {
    keys.add(lastSlashPart)
  }

  const atIndex = normalized.indexOf('@')
  if (atIndex > 0) {
    keys.add(normalized.slice(0, atIndex))
  }

  return Array.from(keys)
}

function isStringNullableRecord(value: unknown): value is Record<string, string | null> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  return Object.values(value).every((item) => item === null || typeof item === 'string')
}

function isProfilePictureLookupResponse(value: unknown): value is ProfilePictureLookupResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const record = value as Record<string, unknown>
  const byIdValid = record.byId === undefined || isStringNullableRecord(record.byId)
  const byUsernameValid =
    record.byUsername === undefined || isStringNullableRecord(record.byUsername)

  return byIdValid && byUsernameValid
}

function findProfilePictureByUsername(
  username: string,
  byUsername: Record<string, string | null>,
): string | null {
  for (const key of buildUsernameLookupKeys(username)) {
    if (Object.prototype.hasOwnProperty.call(byUsername, key)) {
      return byUsername[key] ?? null
    }
  }

  return null
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
        currentUsers: activeBooking?.username ? [activeBooking.username] : [],
        currentUsersWithProfiles: activeBooking?.username
          ? [{ name: activeBooking.username, profilePicture: null }]
          : [],
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
      currentUsers: Array.isArray(row.current_users) ? row.current_users : [],
      currentUsersWithProfiles: Array.isArray(row.current_users)
        ? row.current_users.map((name) => ({ name, profilePicture: null }))
        : [],
      currentUserId: row.current_user_id,
      currentUserProfilePicture: null,
    }
  }

  async function loadOverview(force = false) {
    if (isOverviewLoading.value) {
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

    const machineUsernames = Array.from(
      new Set(
        overviewRows.value
          .flatMap((row) => row.currentUsers)
          .filter((username): username is string => username.trim().length > 0),
      ),
    )

    if (userIds.length === 0 && machineUsernames.length === 0) {
      isOverviewProfilePicturesLoading.value = false
      return
    }

    try {
      isOverviewProfilePicturesLoading.value = true

      const params = new URLSearchParams()
      if (userIds.length > 0) {
        params.set('ids', userIds.join(','))
      }
      if (machineUsernames.length > 0) {
        params.set('usernames', machineUsernames.join(','))
      }

      const response = await fetch(`/api/accounts/profile-pictures?${params.toString()}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch profile pictures: ${response.status}`)
      }

      const payload = (await response.json()) as unknown
      const pictureByUserId: Record<string, string | null> = {}
      const pictureByUsername: Record<string, string | null> = {}

      if (isProfilePictureLookupResponse(payload)) {
        Object.assign(pictureByUserId, payload.byId ?? {})
        Object.assign(pictureByUsername, payload.byUsername ?? {})
      } else if (isStringNullableRecord(payload)) {
        Object.assign(pictureByUserId, payload)
      }

      overviewRows.value = overviewRows.value.map((row) => {
        const profilePictureById = row.currentUserId
          ? (pictureByUserId[String(row.currentUserId)] ?? null)
          : null
        const profilePictureByName = row.currentUser
          ? findProfilePictureByUsername(row.currentUser, pictureByUsername)
          : null
        const profilePicture = profilePictureById ?? profilePictureByName ?? null

        return {
          ...row,
          currentUserProfilePicture: profilePicture,
          currentUsersWithProfiles: row.currentUsers.map((name) => ({
            name,
            profilePicture: findProfilePictureByUsername(name, pictureByUsername),
          })),
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
