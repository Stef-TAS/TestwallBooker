<script lang="ts" setup>
import { DatePicker, Fieldset, Select, Tag, Toast } from 'primevue'
import { useToast } from 'primevue/usetoast'
import Stepper from 'primevue/stepper'
import StepList from 'primevue/steplist'
import StepPanels from 'primevue/steppanels'
import StepItem from 'primevue/stepitem'
import Step from 'primevue/step'
import StepPanel from 'primevue/steppanel'
import { Divider, Button, Card, CommandMenu, RadioButton } from 'primevue'
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'

import AlignCenter from '@primeicons/vue/align-center'
import AlignLeft from '@primeicons/vue/align-left'
import AlignRight from '@primeicons/vue/align-right'
import ArrowDown from '@primeicons/vue/arrow-down'
import ArrowLeft from '@primeicons/vue/arrow-left'
import ArrowRight from '@primeicons/vue/arrow-right'
import ArrowUp from '@primeicons/vue/arrow-up'

import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import ColumnGroup from 'primevue/columngroup' // optional
import Row from 'primevue/row' // optional
import { useTestwallsStore } from '../stores/testwalls'
import { useAccountStore } from '@/stores/account'
import { useBookings, type Booking as ApiBooking } from '@/composables/useBookings'
import { useAccounts, type Account as ApiAccount } from '@/composables/useAccounts'
import { useSettingsStore } from '@/stores/settings'
import { writeToClipboard } from '@/utils/clipboard'

const accountStore = useAccountStore()
const settingsStore = useSettingsStore()
const MAX_BOOKING_DURATION_MS = 24 * 60 * 60 * 1000

const testwallsStore = useTestwallsStore()
const {
  testwallsWithAvailability,
  overviewRows,
  bookings: testwallBookings,
} = storeToRefs(testwallsStore)
const { loadTestwalls, loadOverview } = testwallsStore

const testwallsForSelection = computed(() =>
  overviewRows.value.length > 0 ? overviewRows.value : testwallsWithAvailability.value,
)

const selectedTestwallBookings = computed(() => {
  if (!selectedRadioButton.value) return []
  return testwallBookings.value.filter((b) => b.testwall_id === selectedRadioButton.value)
})

function formatTime(isoString: string): string {
  const d = new Date(isoString)
  if (settingsStore.use24HourTime) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  const h = d.getHours()
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${String(h12).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${ampm}`
}

function getBookingsForDate(date: Date | null) {
  if (!date) return []
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0)
  const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
  return selectedTestwallBookings.value.filter((b) => {
    const from = new Date(b.from_time)
    const to = new Date(b.to_time)
    return from <= dayEnd && to >= dayStart
  })
}

const startDateBookings = computed(() => getBookingsForDate(bookingstart.value))
const endDateBookings = computed(() => getBookingsForDate(bookingend.value))

const conflictingBookings = computed(() => {
  const start = bookingstart.value
  const end = bookingend.value
  if (!start || !end || start >= end) return []
  return selectedTestwallBookings.value.filter((b) => {
    const from = new Date(b.from_time)
    const to = new Date(b.to_time)
    return start < to && end > from
  })
})

const hasBookingConflict = computed(() => conflictingBookings.value.length > 0)

function getUnavailableSpansForDay(
  day: number,
  month: number,
  year: number,
): { from: string; to: string }[] {
  const dayStart = new Date(year, month, day, 0, 0, 0)
  const dayEnd = new Date(year, month, day, 23, 59, 59, 999)

  // Collect intervals as minute offsets within the day
  const intervals = selectedTestwallBookings.value
    .filter((b) => {
      const from = new Date(b.from_time)
      const to = new Date(b.to_time)
      return from <= dayEnd && to >= dayStart
    })
    .map((b) => {
      const from = new Date(b.from_time)
      const to = new Date(b.to_time)
      const startMin = from < dayStart ? 0 : from.getHours() * 60 + from.getMinutes()
      const endMin = to > dayEnd ? 24 * 60 : to.getHours() * 60 + to.getMinutes()
      return { start: startMin, end: endMin }
    })
    .sort((a, b) => a.start - b.start)

  // Merge overlapping/adjacent intervals
  const merged: { start: number; end: number }[] = []
  for (const interval of intervals) {
    const last = merged.at(-1)
    if (last && interval.start <= last.end) {
      last.end = Math.max(last.end, interval.end)
    } else {
      merged.push({ ...interval })
    }
  }

  const pad = (n: number) => String(n).padStart(2, '0')
  return merged.map(({ start, end }) => ({
    from: `${pad(Math.floor(start / 60))}:${pad(start % 60)}`,
    to: end === 24 * 60 ? '24:00' : `${pad(Math.floor(end / 60))}:${pad(end % 60)}`,
  }))
}

type BookingHistory = {
  id: number
  testwallId: number
  testwallName: string
  startDate: Date
  endDate: Date
  status: string
  userEmail: string
}

type BookingHistoryUserOption = {
  label: string
  value: number
}

const { getBookingsByUser, terminateBooking, createBooking, error: bookingApiError } = useBookings()
const toast = useToast()
const { getAllAccounts } = useAccounts()
const bookings = ref<BookingHistory[]>([])
const userOptions = ref<BookingHistoryUserOption[]>([])
const selectedHistoryUserId = ref<number | null>(accountStore.account?.id ?? null)
const terminatingBookingId = ref<number | null>(null)

const canManageHistory = computed(() => accountStore.account?.isAdmin === true)

function parseApiDate(value: string): Date {
  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return new Date(0)
  }

  return parsedDate
}

function normalizeStatus(value: string | undefined): string {
  if (!value) {
    return 'active'
  }

  return value.toLowerCase()
}

function getUserOptionLabel(account: ApiAccount): string {
  return `${account.username} (${account.email})`
}

function escapeSqlString(value: string): string {
  return value.replaceAll("'", "''")
}

function toSqlDatetime(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(
    value.getHours(),
  )}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
}

function buildBookingClipboardText(booking: BookingHistory): string {
  const lines = [
    `Booking ID: ${booking.id}`,
    `Testwall ID: ${booking.testwallId}`,
    `Testwall: ${booking.testwallName}`,
    `Start: ${booking.startDate.toLocaleString()}`,
    `End: ${booking.endDate.toLocaleString()}`,
    `Status: ${booking.status}`,
    `User Email: ${booking.userEmail}`,
  ]

  if (accountStore.account?.isAdmin) {
    lines.push('')
    lines.push('-- Admin SQL ')
    lines.push('')
    lines.push('time format: yyyy-mm-dd hh:mm:ss')
    lines.push('')
    lines.push(
      `UPDATE bookings SET testwall_id = ${booking.testwallId}, from_time = '${toSqlDatetime(booking.startDate)}', to_time = '${toSqlDatetime(booking.endDate)}', status = '${escapeSqlString(booking.status)}' WHERE id = ${booking.id};`,
    )
  }

  return lines.join('\n')
}

async function handleBookingHistoryRowClick(booking: BookingHistory) {
  try {
    await writeToClipboard(buildBookingClipboardText(booking))
    toast.add({
      severity: 'success',
      summary: 'Copied Booking Info',
      detail: accountStore.account?.isAdmin
        ? `Copied booking ${booking.id} details and SQL update statement to the clipboard.`
        : `Copied booking ${booking.id} details to the clipboard.`,
      life: 4000,
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Copy Failed',
      detail: error instanceof Error ? error.message : 'Could not copy booking details.',
      life: 5000,
    })
  }
}

function getBookingHistoryRowClass(): string {
  return 'cursor-pointer [&>td]:transition-colors [&>td]:duration-150 hover:[&>td]:bg-slate-100/70 dark:hover:[&>td]:bg-slate-800/60'
}

async function loadUserOptions() {
  if (!canManageHistory.value) {
    userOptions.value = []
    selectedHistoryUserId.value = accountStore.account?.id ?? null
    return
  }

  const accounts = await getAllAccounts()
  userOptions.value = accounts.map((account: ApiAccount) => ({
    label: getUserOptionLabel(account),
    value: account.id,
  }))

  if (
    selectedHistoryUserId.value == null ||
    !userOptions.value.some((account) => account.value === selectedHistoryUserId.value)
  ) {
    selectedHistoryUserId.value = accountStore.account?.id ?? userOptions.value[0]?.value ?? null
  }
}

async function loadBookings() {
  if (!selectedHistoryUserId.value) {
    bookings.value = []
    return
  }

  const data = await getBookingsByUser(selectedHistoryUserId.value)
  bookings.value = data.map((booking: ApiBooking) => ({
    id: booking.id,
    testwallId: booking.testwall_id,
    testwallName: booking.testwall_name ?? `Testwall ${booking.testwall_id}`,
    startDate: parseApiDate(booking.from_time),
    endDate: parseApiDate(booking.to_time),
    status: normalizeStatus(booking.status),
    userEmail: booking.user_email ?? accountStore.account?.email ?? '',
  }))
}

async function handleTerminateBooking(bookingId: number) {
  terminatingBookingId.value = bookingId

  try {
    const wasTerminated = await terminateBooking(bookingId)
    if (!wasTerminated) {
      return
    }

    await loadBookings()
  } finally {
    terminatingBookingId.value = null
  }
}

onMounted(() => {
  void loadTestwalls()
  void loadOverview()
  void loadUserOptions().then(loadBookings)
})

watch(
  () => accountStore.account?.id,
  (accountId) => {
    if (!canManageHistory.value) {
      selectedHistoryUserId.value = accountId ?? null
      void loadBookings()
    }
  },
)

watch(
  () => accountStore.account?.isAdmin,
  () => {
    void loadUserOptions().then(loadBookings)
  },
)

watch(selectedHistoryUserId, () => {
  void loadBookings()
})

const canTerminateBooking = (booking: BookingHistory) => booking.status === 'active'

const selectedRadioButton = ref<number | undefined>()
const isSubmittingBooking = ref(false)

const selectedTestwall = computed(
  () => testwallsForSelection.value.find((t) => t.id === selectedRadioButton.value) ?? null,
)
const isSelectedTestwallOutOfService = computed(
  () => selectedTestwall.value?.availabilityStatus === 'out_of_service',
)

const bookingstart = ref(new Date(Date.now()))
const bookingend = ref(new Date(Date.now()))

const bookingRangeDurationMs = computed(
  () => bookingend.value.getTime() - bookingstart.value.getTime(),
)
const hasInvalidTimeRange = computed(() => bookingRangeDurationMs.value <= 0)
const exceedsMaxBookingDuration = computed(
  () => bookingRangeDurationMs.value > MAX_BOOKING_DURATION_MS,
)
const hasBookingValidationError = computed(
  () => hasBookingConflict.value || hasInvalidTimeRange.value || exceedsMaxBookingDuration.value,
)

async function handleFinishBooking() {
  if (!selectedRadioButton.value || !accountStore.account?.id) return

  if (hasInvalidTimeRange.value) {
    toast.add({
      severity: 'warn',
      summary: 'Invalid Timeframe',
      detail: 'End date and time must be later than start date and time.',
      life: 5000,
    })
    return
  }

  if (exceedsMaxBookingDuration.value) {
    toast.add({
      severity: 'warn',
      summary: 'Maximum Booking Length Reached',
      detail:
        'A booking can be at most 24 hours. Split longer reservations into separate bookings.',
      life: 6000,
    })
    return
  }

  isSubmittingBooking.value = true
  try {
    const result = await createBooking(
      selectedRadioButton.value,
      accountStore.account.id,
      bookingstart.value.toISOString(),
      bookingend.value.toISOString(),
    )
    if (result) {
      toast.add({
        severity: 'success',
        summary: 'Booking Confirmed',
        detail: `Your booking for ${selectedTestwall.value?.name ?? 'the testwall'} has been successfully added.`,
        life: 5000,
      })
      await loadTestwalls()
      await loadBookings()
    } else {
      toast.add({
        severity: 'error',
        summary: 'Booking Failed',
        detail: bookingApiError.value || 'Could not create the booking. Please try again.',
        life: 5000,
      })
    }
  } finally {
    isSubmittingBooking.value = false
  }
}
</script>
<template>
  <div :class="{ 'compact-page': settingsStore.compactView }">
    <Toast />
    <Card class="relative overflow-hidden border border-blue-500/20 shadow-xl mb-6">
      <template #content>
        <div class="absolute -top-24 -right-16 h-48 w-48 rounded-full bg-blue-500/15 blur-2xl" />
        <div class="absolute -bottom-28 -left-16 h-56 w-56 rounded-full bg-cyan-500/15 blur-2xl" />

        <div class="relative z-10">
          <div class="flex flex-wrap items-center gap-2 mb-3">
            <Tag severity="info" value="Booking Flow" />
            <Tag severity="success" value="Reserve Testwalls" />
          </div>

          <h1 class="text-3xl font-semibold tracking-tight">Booking</h1>
          <p class="mt-3 text-sm leading-6 opacity-80 max-w-3xl">
            Reserve a testwall by selecting a valid timeframe and available wall, then review your
            booking history and status updates in one place.
          </p>
        </div>
      </template>
    </Card>

    <div class="mb-4">
      <Card>
        <template #content>
          <Stepper value="1" linear>
            <StepList>
              <Step value="1">Confirm Account Information</Step>
              <Step value="2">Select Testwall</Step>
              <Step value="3">Select Timeframe</Step>
              <Step value="4">Confirm Booking</Step>
            </StepList>
            <StepPanels class="w-full max-w-3/5 justify-self-center">
              <StepPanel class="shadow-lg" v-slot="{ activateCallback }" value="1">
                <Card>
                  <template #content>
                    <p>These are your current Account informations:</p>
                    <div class="flex flex-col text-sm p-2">
                      <div class="flex justify-between">
                        <span class="text-color">Username</span>
                        <span class="text-muted-color">{{ accountStore.account?.username }}</span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-color">Email</span>
                        <span class="text-muted-color">{{ accountStore.account?.email }}</span>
                      </div>
                      <Divider />
                      <div class="flex justify-between">
                        <span class="text-color">First Name</span>
                        <span class="text-muted-color">{{ accountStore.account?.firstName }}</span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-color">Last Name</span>
                        <span class="text-muted-color">{{ accountStore.account?.lastName }}</span>
                      </div>
                      <Divider />
                      <div class="flex justify-between">
                        <span class="text-color">Access Right(s)</span>
                        <span class="text-muted-color">
                          <Tag v-if="accountStore.account?.isAdmin" severity="danger">Admin</Tag>
                          <Tag v-if="accountStore.account?.canTestwall" severity="info"
                            >Testwall</Tag
                          >
                          <Tag
                            v-if="
                              !accountStore.account?.isAdmin && !accountStore.account?.canTestwall
                            "
                            severity="success"
                            >Observer</Tag
                          >
                        </span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-color">Location</span>
                        <span class="text-muted-color">{{ accountStore.account?.location }}</span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-color">Timezone</span>
                        <span class="text-muted-color">{{ accountStore.account?.timezone }}</span>
                      </div>
                    </div>
                    <div class="flex pt-5 justify-end">
                      <Button @click="activateCallback('2')">
                        Next
                        <ArrowRight />
                      </Button>
                    </div>
                  </template>
                </Card>
              </StepPanel>

              <StepPanel class="shadow-lg" v-slot="{ activateCallback }" value="2">
                <Card>
                  <template #content>
                    <div>
                      <CommandMenu
                        :model="testwallsForSelection"
                        placeholder="Search for Testwalls..."
                      >
                        <template #item="{ item }">
                          <label
                            :for="`testwall-${item.id}`"
                            class="flex items-center gap-3.5 py-1 px-2.5 w-full"
                            :class="
                              item.availabilityStatus === 'out_of_service'
                                ? 'cursor-not-allowed opacity-60'
                                : 'cursor-pointer'
                            "
                          >
                            <RadioButton
                              v-model="selectedRadioButton"
                              :input-id="`testwall-${item.id}`"
                              name="testwall"
                              :value="item.id"
                              :disabled="item.availabilityStatus === 'out_of_service'"
                            />
                            <span class="text-sm">{{ item.name }}</span>
                            <Tag
                              v-if="item.availabilityStatus === 'out_of_service'"
                              severity="danger"
                              >Out of Service</Tag
                            >
                            <Tag v-else severity="success">Available</Tag>
                          </label>
                        </template>
                        <template #footer>
                          <div class="flex items-center justify-end gap-3 w-full">
                            <span class="flex items-center gap-1 text-surface-500 text-xs">
                              <kbd
                                class="bg-surface-100 dark:bg-surface-800 size-5 inline-flex items-center justify-center rounded border border-surface-200 dark:border-surface-700"
                              >
                                <ArrowUp />
                              </kbd>
                              <kbd
                                class="bg-surface-100 dark:bg-surface-800 size-5 inline-flex items-center justify-center rounded border border-surface-200 dark:border-surface-700"
                              >
                                <ArrowDown />
                              </kbd>
                              Navigate
                            </span>
                            <span class="flex items-center gap-1 text-surface-500 text-xs">
                              <kbd
                                class="bg-surface-100 dark:bg-surface-800 size-5 inline-flex items-center justify-center rounded border border-surface-200 dark:border-surface-700"
                              >
                                &#x21B5;
                              </kbd>
                              Select
                            </span>
                          </div>
                        </template>
                      </CommandMenu>
                    </div>
                    <div class="flex pt-5 justify-between">
                      <Button severity="secondary" @click="activateCallback('1')">
                        <ArrowLeft />
                        Back
                      </Button>
                      <Button
                        @click="activateCallback('3')"
                        :disabled="
                          selectedRadioButton == undefined || isSelectedTestwallOutOfService
                        "
                      >
                        Next
                        <ArrowRight />
                      </Button>
                    </div>
                  </template>
                </Card>
              </StepPanel>
              <StepPanel class="shadow-lg" v-slot="{ activateCallback }" value="3">
                <Card>
                  <template #content>
                    <div class="flex flex-wrap gap-4">
                      <div class="flex-auto">
                        <label for="BookingStartPicker" class="block">Start Date&Time</label>
                        <DatePicker
                          v-model="bookingstart"
                          showIcon
                          showTime
                          :hourFormat="settingsStore.use24HourTime ? '24' : '12'"
                          fluid
                          inputId="BookingStartPicker"
                          :min-date="new Date(Date.now())"
                        >
                          <template #date="{ date }">
                            <span
                              :class="{
                                'text-orange-400 font-semibold':
                                  getUnavailableSpansForDay(date.day, date.month, date.year)
                                    .length > 0,
                              }"
                              >{{ date.day }}</span
                            >
                          </template>
                          <template #footer>
                            <div v-if="startDateBookings.length > 0" class="px-3 pb-3 pt-1">
                              <p class="text-xs font-medium text-orange-400 mb-1">
                                Bookings on this day:
                              </p>
                              <ul class="flex flex-col gap-1">
                                <li
                                  v-for="b in startDateBookings"
                                  :key="b.id"
                                  class="flex justify-between rounded px-2 py-1 bg-orange-500/10 text-xs"
                                >
                                  <span
                                    >{{ formatTime(b.from_time) }} –
                                    {{ formatTime(b.to_time) }}</span
                                  >
                                  <span v-if="b.username" class="opacity-60">{{ b.username }}</span>
                                </li>
                              </ul>
                            </div>
                          </template>
                        </DatePicker>
                      </div>
                      <div class="flex-auto">
                        <label for="BookingEndPicker" class="block">End Date&Time</label>
                        <DatePicker
                          v-model="bookingend"
                          showIcon
                          showTime
                          :hourFormat="settingsStore.use24HourTime ? '24' : '12'"
                          fluid
                          inputId="BookingEndPicker"
                          :min-date="bookingstart"
                        >
                          <template #date="{ date }">
                            <span
                              :class="{
                                'text-orange-400 font-semibold':
                                  getUnavailableSpansForDay(date.day, date.month, date.year)
                                    .length > 0,
                              }"
                              >{{ date.day }}</span
                            >
                          </template>
                          <template #footer>
                            <div v-if="endDateBookings.length > 0" class="px-3 pb-3 pt-1">
                              <p class="text-xs font-medium text-orange-400 mb-1">
                                Bookings on this day:
                              </p>
                              <ul class="flex flex-col gap-1">
                                <li
                                  v-for="b in endDateBookings"
                                  :key="b.id"
                                  class="flex justify-between rounded px-2 py-1 bg-orange-500/10 text-xs"
                                >
                                  <span
                                    >{{ formatTime(b.from_time) }} –
                                    {{ formatTime(b.to_time) }}</span
                                  >
                                  <span v-if="b.username" class="opacity-60">{{ b.username }}</span>
                                </li>
                              </ul>
                            </div>
                          </template>
                        </DatePicker>
                      </div>
                    </div>
                    <div
                      v-if="hasBookingConflict"
                      class="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400"
                    >
                      <p class="font-medium mb-1">
                        Selected timeframe conflicts with existing bookings:
                      </p>
                      <ul class="flex flex-col gap-0.5">
                        <li v-for="b in conflictingBookings" :key="b.id" class="flex gap-2 text-xs">
                          <span>{{ formatTime(b.from_time) }} – {{ formatTime(b.to_time) }}</span>
                          <span v-if="b.username" class="opacity-60">{{ b.username }}</span>
                        </li>
                      </ul>
                    </div>
                    <div
                      v-if="hasInvalidTimeRange"
                      class="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300"
                    >
                      End date and time must be later than the start date and time.
                    </div>
                    <div
                      v-if="exceedsMaxBookingDuration"
                      class="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400"
                    >
                      A single booking can be at most 24 hours. For multi-day usage, create one
                      booking per day.
                    </div>
                    <div class="flex pt-5 justify-between">
                      <Button severity="secondary" @click="activateCallback('2')">
                        <ArrowLeft />
                        Back
                      </Button>
                      <Button @click="activateCallback('4')" :disabled="hasBookingValidationError">
                        Next
                        <ArrowRight />
                      </Button>
                    </div>
                  </template>
                </Card>
              </StepPanel>
              <StepPanel class="shadow-lg" v-slot="{ activateCallback }" value="4">
                <Card>
                  <template #content>
                    <p>Confirm that your booking has been defined correctly</p>
                    <Divider />
                    <div class="flex justify-between gap-4">
                      <Fieldset legend="Account Information" class="w-full">
                        <div class="flex flex-col text-sm p-2">
                          <div class="flex justify-between">
                            <span class="text-color">Username</span>
                            <span class="text-muted-color">{{
                              accountStore.account?.username
                            }}</span>
                          </div>
                          <div class="flex justify-between">
                            <span class="text-color">Email</span>
                            <span class="text-muted-color">{{ accountStore.account?.email }}</span>
                          </div>
                        </div>
                      </Fieldset>
                      <Fieldset legend="Testwall Information" class="w-full">
                        <div class="flex flex-col text-sm p-2">
                          <div class="flex justify-between">
                            <span class="text-color">Selected Testwall</span>
                            <span class="text-muted-color">{{
                              selectedTestwall?.name ?? '—'
                            }}</span>
                          </div>
                          <div class="flex justify-between">
                            <span class="text-color">Current Status</span>
                            <Tag v-if="selectedTestwall?.isAvailable" severity="success"
                              >Available</Tag
                            >
                            <Tag
                              v-else-if="selectedTestwall?.availabilityStatus === 'out_of_service'"
                              severity="secondary"
                              >Out of Service</Tag
                            >
                            <Tag v-else severity="danger">Unavailable</Tag>
                          </div>
                        </div>
                      </Fieldset>
                      <Fieldset legend="Selected TimeFrame" class="w-full">
                        <div class="flex flex-col text-sm p-2">
                          <div class="flex justify-between mb-1">
                            <span class="text-color font-medium">Start</span>
                            <span class="text-muted-color">{{
                              bookingstart.toLocaleString()
                            }}</span>
                          </div>
                          <div class="flex justify-between">
                            <span class="text-color font-medium">End</span>
                            <span class="text-muted-color">{{ bookingend.toLocaleString() }}</span>
                          </div>
                        </div>
                      </Fieldset>
                    </div>
                    <div class="flex pt-5 justify-between">
                      <Button severity="secondary" @click="activateCallback('3')">
                        <ArrowLeft />
                        Back
                      </Button>
                      <Button
                        @click="handleFinishBooking"
                        :loading="isSubmittingBooking"
                        :disabled="isSubmittingBooking || hasBookingValidationError"
                      >
                        Finish Booking
                        <ArrowRight />
                      </Button>
                    </div>
                  </template>
                </Card>
              </StepPanel>
            </StepPanels>
          </Stepper>
        </template>
      </Card>
    </div>
    <div>
      <Fieldset legend="Booking History" class="max-w-4/5 w-full justify-self-center">
        <div
          v-if="accountStore.account?.isAdmin && accountStore.showAdminContent"
          class="mb-4 flex flex-col gap-2 md:max-w-xl"
        >
          <label for="booking-history-user-select" class="text-sm font-medium">History User</label>
          <Select
            inputId="booking-history-user-select"
            v-model="selectedHistoryUserId"
            :options="userOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Select a user"
            filter
            class="w-full"
          />
        </div>
        <DataTable
          v-if="bookings.length > 0"
          :value="bookings"
          tableStyle="min-width: 50rem"
          stripedRows
          removableSort
          sortField="status"
          :sortOrder="1"
          paginator
          :rows="5"
          :rowsPerPageOptions="[5, 10, 50, 100, 150]"
          :size="settingsStore.compactView ? 'small' : undefined"
          :rowClass="getBookingHistoryRowClass"
          @row-click="({ data }) => handleBookingHistoryRowClick(data)"
        >
          <Column field="id" header="BookingId" sortable />
          <Column field="testwallId" header="TestwallId" sortable />
          <Column field="testwallName" header="Testwall" sortable />
          <Column field="startDate" header="Start Date" sortable>
            <template #body="{ data }">
              <p>{{ data.startDate.toLocaleString() }}</p>
            </template>
          </Column>
          <Column field="endDate" header="End Date" sortable>
            <template #body="{ data }">
              <p>{{ data.endDate.toLocaleString() }}</p>
            </template>
          </Column>
          <Column field="status" header="Status" sortable>
            <template #body="{ data }">
              <Tag v-if="data.status == 'active'" severity="success">Active</Tag>
              <Tag v-if="data.status == 'forcequit'" severity="warn">Force Quited</Tag>
              <Tag v-if="data.status == 'finished'" severity="info">Finished</Tag>
              <Tag v-if="data.status == 'crashed'" severity="danger">crashed</Tag>
              <Tag
                v-if="
                  data.status != 'active' &&
                  data.status != 'forcequit' &&
                  data.status != 'finished' &&
                  data.status != 'crashed'
                "
                severity="secondary"
                >{{ data.status }}</Tag
              >
            </template>
          </Column>
          <Column field="userEmail" header="UserEmail" sortable />
          <Column header="Actions">
            <template #body="{ data }">
              <Button
                label="Terminate"
                severity="danger"
                size="small"
                v-if="data.status == 'active'"
                :disabled="!canTerminateBooking(data) || terminatingBookingId === data.id"
                @click.stop="handleTerminateBooking(data.id)"
              />
            </template>
          </Column>
        </DataTable>
        <p
          v-if="bookings.length < 1"
          class="text-2xl opacity-40 justify-self-center align-middle p-10"
        >
          No Bookings found
        </p>
      </Fieldset>
    </div>
  </div>
</template>
