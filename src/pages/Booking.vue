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

import AlignCenter from '@primeicons/vue/align-center'
import AlignLeft from '@primeicons/vue/align-left'
import AlignRight from '@primeicons/vue/align-right'
import ArrowDown from '@primeicons/vue/arrow-down'
import ArrowLeft from '@primeicons/vue/arrow-left'
import ArrowRight from '@primeicons/vue/arrow-right'
import ArrowUp from '@primeicons/vue/arrow-up'

type Testwall = {
  testwallId: number
  testwallName: string
  isAvailable: boolean
  user: string
}

const testwalls = ref<Testwall[]>([])
const isLoading = ref(true)
const loadError = ref('')
const testwallsFileUrl = new URL('../data/testwalls.json', import.meta.url).href

async function loadTestwalls() {
  try {
    isLoading.value = true
    loadError.value = ''

    const response = await fetch(testwallsFileUrl)
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`)
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      throw new Error('Data file did not return JSON content')
    }

    const data = (await response.json()) as Testwall[]
    testwalls.value = data
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'Unknown error'
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  void loadTestwalls()
})

const selectedRadioButton = ref()

const bookingstart = ref()
const bookingend = ref()
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
      <StepPanels>
        <StepPanel v-slot="{ activateCallback }" value="1">
          <Card>
            <template #content>
              <p>These are your current Account informations:</p>
              <div class="flex flex-col text-sm p-2">
                <div class="flex justify-between">
                  <span class="text-color">Username</span>
                  <span class="text-muted-color">Dingus</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-color">Email</span>
                  <span class="text-muted-color">dingus@ttcontrol.com</span>
                </div>
                <Divider />
                <div class="flex justify-between">
                  <span class="text-color">First Name</span>
                  <span class="text-muted-color">Dingus</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-color">Last Name</span>
                  <span class="text-muted-color">Bingus</span>
                </div>
                <Divider />
                <div class="flex justify-between">
                  <span class="text-color">Access Right(s)</span>
                  <span class="text-muted-color">Testwall, Query, Admin</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-color">Location</span>
                  <span class="text-muted-color">TTControl GmbH, AUT, Wien</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-color">Timezone</span>
                  <span class="text-muted-color">Europe/Vienna</span>
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
                    :min-date="new Date(Date.now())"
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
                <Button @click="activateCallback('4')">
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
              <div class="flex flex-row">
                <Fieldset legend="Account Information">
                  <div class="flex flex-col text-sm p-2">
                    <div class="flex justify-between">
                      <span class="text-color">Username</span>
                      <span class="text-muted-color">Dingus</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-color">Email</span>
                      <span class="text-muted-color">dingus@ttcontrol.com</span>
                    </div>
                  </div>
                </Fieldset>
                <Fieldset legend="Testwall Information">
                  <div class="flex flex-col text-sm p-2">
                    <div class="flex justify-between">
                      <span class="text-color">Selected Testwall</span>
                      <span class="text-muted-color">Current Status</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-color">Testwall 2</span>
                    </div>
                  </div>
                </Fieldset>
                <Fieldset legend="Selected TimeFrame">
                  <div class="flex flex-col text-sm p-2">
                    <div class="flex justify-between">
                      <span class="text-color">Startdate</span>
                      <span class="text-muted-color">Enddate</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-color">{{ bookingstart }}</span>
                      <span class="text-muted-color">{{ bookingend }}</span>
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
</template>
