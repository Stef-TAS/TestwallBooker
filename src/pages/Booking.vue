<script lang="ts" setup>
import { DatePicker, Fieldset, Select, Tag } from 'primevue'
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

const accountStore = useAccountStore()

const testwallsStore = useTestwallsStore()
const { testwallsWithAvailability, bookings: testwallBookings } = storeToRefs(testwallsStore)
const { loadTestwalls } = testwallsStore

const selectedTestwallBookings = computed(() => {
  if (!selectedRadioButton.value) return []
  return testwallBookings.value.filter((b) => b.testwall_id === selectedRadioButton.value)
})

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function getUnavailableSpansForDay(
  day: number,
  month: number,
  year: number,
): { from: string; to: string }[] {
  const dayStart = new Date(year, month, day, 0, 0, 0)
  const dayEnd = new Date(year, month, day, 23, 59, 59, 999)
  return selectedTestwallBookings.value
    .filter((b) => {
      const from = new Date(b.from_time)
      const to = new Date(b.to_time)
      return from <= dayEnd && to >= dayStart
    })
    .map((b) => {
      const from = new Date(b.from_time)
      const to = new Date(b.to_time)
      return {
        from: from < dayStart ? '00:00' : formatTime(from),
        to: to > dayEnd ? '24:00' : formatTime(to),
      }
    })
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

const { getBookingsByUser, terminateBooking } = useBookings()
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

const selectedRadioButton = ref()

const bookingstart = ref(new Date(Date.now()))
const bookingend = ref(new Date(Date.now()))
</script>
<template>
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
                        <Tag v-if="accountStore.account?.canTestwall" severity="info">Testwall</Tag>
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
                      :model="testwallsWithAvailability"
                      placeholder="Search for Testwalls..."
                    >
                      <template #item="{ item }">
                        <div class="flex items-center gap-3.5 py-1 px-2.5 w-full">
                          <RadioButton
                            v-model="selectedRadioButton"
                            ,
                            :input-id="item.id"
                            name="testwall"
                            :value="item.id"
                            :disabled="item.isAvailable == false"
                          />
                          <span class="text-sm">{{ item.name }}</span>
                          <Tag v-if="item.isAvailable == true" severity="success">Available</Tag>
                          <Tag v-if="item.isAvailable == false" severity="danger">Unavailable</Tag>
                        </div>
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
                      :disabled="selectedRadioButton == undefined"
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
                        hourFormat="24"
                        fluid
                        inputId="BookingStartPicker"
                        :min-date="new Date(Date.now())"
                      >
                        <template #date="{ date }">
                          <div class="flex flex-col items-center gap-0.5">
                            <span>{{ date.day }}</span>
                            <span
                              v-for="span in getUnavailableSpansForDay(
                                date.day,
                                date.month,
                                date.year,
                              )"
                              :key="span.from"
                              class="text-[8px] leading-tight text-red-400 whitespace-nowrap px-0.5 rounded bg-red-500/10"
                              >{{ span.from }}-{{ span.to }}</span
                            >
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
                        hourFormat="24"
                        fluid
                        inputId="BookingEndPicker"
                        :min-date="bookingstart"
                      >
                        <template #date="{ date }">
                          <div class="flex flex-col items-center gap-0.5">
                            <span>{{ date.day }}</span>
                            <span
                              v-for="span in getUnavailableSpansForDay(
                                date.day,
                                date.month,
                                date.year,
                              )"
                              :key="span.from"
                              class="text-[8px] leading-tight text-red-400 whitespace-nowrap px-0.5 rounded bg-red-500/10"
                              >{{ span.from }}-{{ span.to }}</span
                            >
                          </div>
                        </template>
                      </DatePicker>
                    </div>
                  </div>
                  <div class="flex pt-5 justify-between">
                    <Button severity="secondary" @click="activateCallback('2')">
                      <ArrowLeft />
                      Back
                    </Button>
                    <Button @click="activateCallback('4')">
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
                          <span class="text-muted-color">User</span>
                        </div>
                        <div class="flex justify-between">
                          <span class="text-color">Email</span>
                          <span class="text-muted-color">User@ttcontrol.com</span>
                        </div>
                      </div>
                    </Fieldset>
                    <Fieldset legend="Testwall Information" class="w-full">
                      <div class="flex flex-col text-sm p-2">
                        <div class="flex justify-between">
                          <span class="text-color">Selected Testwall</span>
                          <span class="text-color">Testwall 2</span>
                        </div>
                        <div class="flex justify-between">
                          <span class="text-muted-color">Current Status</span>
                          <Tag severity="success">Available</Tag>
                        </div>
                      </div>
                    </Fieldset>
                    <Fieldset legend="Selected TimeFrame" class="w-full">
                      <div class="flex flex-col text-sm p-2">
                        <div class="flex justify-between">
                          <span class="text-color">Startdate</span>
                          <span class="text-muted-color">Enddate</span>
                        </div>
                        <div class="flex justify-between">
                          <span class="text-color">{{ bookingstart.toLocaleDateString() }}</span>
                          <span class="text-muted-color">{{
                            bookingend.toLocaleDateString()
                          }}</span>
                        </div>
                      </div>
                    </Fieldset>
                  </div>
                  <div class="flex pt-5 justify-between">
                    <Button severity="secondary" @click="activateCallback('3')">
                      <ArrowLeft />
                      Back
                    </Button>
                    <Button @click="">
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
      <div v-if="canManageHistory" class="mb-4 flex flex-col gap-2 md:max-w-xl">
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
        paginator
        :rows="10"
        :rowsPerPageOptions="[5, 10, 50, 100, 150]"
      >
        <Column field="id" header="BookingId" sortable />
        <Column field="testwallId" header="TestwallId" sortable />
        <Column field="testwallName" header="Testwall" sortable />
        <Column field="startDate" header="StartDate" sortable>
          <template #body="{ data }">
            <p>{{ data.startDate.toLocaleDateString() }}</p>
          </template>
        </Column>
        <Column field="endDate" header="EndDate" sortable>
          <template #body="{ data }">
            <p>{{ data.endDate.toLocaleDateString() }}</p>
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
              @click="handleTerminateBooking(data.id)"
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
</template>
