<script lang="ts" setup>
import { DatePicker, Fieldset, Tag } from 'primevue'
import Stepper from 'primevue/stepper'
import StepList from 'primevue/steplist'
import StepPanels from 'primevue/steppanels'
import StepItem from 'primevue/stepitem'
import Step from 'primevue/step'
import StepPanel from 'primevue/steppanel'
import { Divider, Button, Card, CommandMenu, RadioButton } from 'primevue'
import { onMounted, ref } from 'vue'
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

const accountStore = useAccountStore()

const testwallsStore = useTestwallsStore()
const { testwalls } = storeToRefs(testwallsStore)
const { loadTestwalls } = testwallsStore

type BookingHistory = {
  id: number
  testwallId: number
  testwallName: string
  startDate: Date
  endDate: Date
  status: string
  userEmail: string
}

const { getBookingsByUser } = useBookings()
const bookings = ref<BookingHistory[]>([])

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

async function loadBookings() {
  if (!accountStore.account?.id) {
    bookings.value = []
    return
  }

  const data = await getBookingsByUser(accountStore.account.id)
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

onMounted(() => {
  void loadTestwalls()
  void loadBookings()
})

const selectedRadioButton = ref()

const bookingstart = ref(new Date(Date.now()))
const bookingend = ref(new Date(Date.now()))
</script>
<template>
  <div class="mb-4">
    <p class="text-2xl">Booking</p>
    <p class="text-sm">See all the information about you and your settings.</p>
  </div>

  <div>
    <Stepper value="1" linear>
      <StepList>
        <Step value="1">Confirm Account Information</Step>
        <Step value="2">Select Timeframe</Step>
        <Step value="3">Select Testwall</Step>
        <Step value="4">Confirm Booking</Step>
      </StepList>
      <StepPanels class="w-full max-w-3/5 justify-self-center">
        <StepPanel v-slot="{ activateCallback }" value="1">
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
                      v-if="!accountStore.account?.isAdmin && !accountStore.account?.canTestwall"
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

        <StepPanel v-slot="{ activateCallback }" value="2">
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
                  />
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
                  />
                </div>
              </div>
              <div class="flex pt-5 justify-between">
                <Button severity="secondary" @click="activateCallback('1')">
                  <ArrowLeft />
                  Back
                </Button>
                <Button @click="activateCallback('3')">
                  Next
                  <ArrowRight />
                </Button>
              </div>
            </template>
          </Card>
        </StepPanel>
        <StepPanel v-slot="{ activateCallback }" value="3">
          <Card>
            <template #content>
              <div>
                <CommandMenu :model="testwalls" placeholder="Search for Testwalls...">
                  <template #item="{ item }">
                    <div class="flex items-center gap-3.5 py-1 px-2.5 w-full">
                      <RadioButton
                        v-model="selectedRadioButton"
                        ,
                        :input-id="item.testwallId"
                        name="testwall"
                        :value="item.testwallId"
                        :disabled="item.isAvailable == false"
                      />
                      <span class="text-sm">{{ item.testwallName }}</span>
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
                <Button severity="secondary" @click="activateCallback('2')">
                  <ArrowLeft />
                  Back
                </Button>
                <Button @click="activateCallback('4')" :disabled="selectedRadioButton == undefined">
                  Next
                  <ArrowRight />
                </Button>
              </div>
            </template>
          </Card>
        </StepPanel>
        <StepPanel v-slot="{ activateCallback }" value="4">
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
                      <span class="text-muted-color">{{ bookingend.toLocaleDateString() }}</span>
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
  </div>
  <div>
    <Fieldset legend="Booking History" class="max-w-4/5 w-full justify-self-center">
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
