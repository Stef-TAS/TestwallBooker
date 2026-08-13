<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { Button, Card, Divider, Tag, Toast } from 'primevue'
import { useToast } from 'primevue/usetoast'
import { useSettingsStore } from '@/stores/settings'
import { useAccountStore } from '@/stores/account'
import {
  useAgent,
  type AgentChatMessage,
  type AgentModeInfo,
  type AgentQuota,
} from '@/composables/useAgent'

const toast = useToast()
const settingsStore = useSettingsStore()
const accountStore = useAccountStore()
const { getQuota, sendMessage, loading, error } = useAgent()

const input = ref('')
const messages = ref<AgentChatMessage[]>([
  {
    role: 'assistant',
    content:
      'Shared builder-agent workspace is active. The current temporary agent only solves arithmetic while the final predefined agent is being prepared.',
  },
])
const quota = ref<AgentQuota | null>(null)
const agentMode = ref<AgentModeInfo>({
  mode: 'math-only',
  provider: 'math-fallback',
  builderTunnelReady: false,
})

const examplePrompts = ['calculate (17 + 25) / 6', 'what is 49 * 13?', 'solve 144 / (3 + 9)']

const canUseAgent = computed(
  () => accountStore.account?.isAdmin === true || accountStore.account?.canTestwall === true,
)
const quotaRatio = computed(() => {
  if (!quota.value || quota.value.dailyLimit <= 0) {
    return 0
  }

  return Math.min((quota.value.usedTokens / quota.value.dailyLimit) * 100, 100)
})
const quotaTone = computed(() => {
  if (quotaRatio.value >= 85) {
    return 'danger'
  }

  if (quotaRatio.value >= 60) {
    return 'warn'
  }

  return 'success'
})

async function refreshQuota() {
  const nextQuota = await getQuota()
  if (nextQuota) {
    quota.value = nextQuota
  }
}

async function submitMessage() {
  const message = input.value.trim()
  if (!message || loading.value || !canUseAgent.value) {
    return
  }

  const history = [...messages.value]
  messages.value.push({ role: 'user', content: message })
  input.value = ''

  const response = await sendMessage({ message, history })
  if (!response) {
    toast.add({
      severity: 'error',
      summary: 'Agent request failed',
      detail: error.value || 'Unknown error',
      life: 4000,
    })
    return
  }

  messages.value.push(response.message)
  quota.value = response.quota
  agentMode.value = response.agent
}

function useExamplePrompt(prompt: string) {
  input.value = prompt
}

onMounted(async () => {
  if (!canUseAgent.value) {
    toast.add({
      severity: 'warn',
      summary: 'Access denied',
      detail: 'The Agent page is limited to admins and operators.',
      life: 4000,
    })
    return
  }

  await refreshQuota()
})
</script>

<template>
  <div>
    <Toast />

    <div :class="['max-w-6xl mx-auto pb-10', { 'compact-page': settingsStore.compactView }]">
      <Card class="agent-hero shadow-xl mb-6 overflow-hidden">
        <template #content>
          <div class="agent-hero__glow agent-hero__glow--top" />
          <div class="agent-hero__glow agent-hero__glow--bottom" />

          <div
            class="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
          >
            <div class="max-w-3xl">
              <div class="flex flex-wrap items-center gap-2 mb-3">
                <Tag severity="contrast" value="Agent" />
                <Tag severity="info" value="Shared Builder Account" />
                <Tag
                  :severity="agentMode.builderTunnelReady ? 'success' : 'warn'"
                  :value="agentMode.builderTunnelReady ? 'SDK Auth Ready' : 'Math Fallback'"
                />
              </div>

              <h1 class="text-3xl font-semibold tracking-tight">Operations Agent</h1>
              <p class="mt-3 text-sm leading-6 opacity-85">
                All prompts on this page are intended to route through a shared builder account once
                the final predefined Copilot agent is provided. Until then, the backend is
                quota-controlled and runs a temporary math-only agent so the tunnel and budgeting
                flow can be validated safely.
              </p>
            </div>

            <div v-if="quota" class="agent-quota-card rounded-2xl px-4 py-3 shadow-lg">
              <div class="text-xs uppercase tracking-[0.2em] opacity-65">Daily budget</div>
              <div class="mt-2 flex items-end gap-3">
                <div class="text-2xl font-semibold">{{ quota.remainingTokens }}</div>
                <div class="text-sm opacity-70">tokens left</div>
              </div>
              <div class="mt-3 h-2 overflow-hidden rounded-full bg-black/10">
                <div
                  class="agent-quota-fill"
                  :class="`agent-quota-fill--${quotaTone}`"
                  :style="{ width: `${quotaRatio}%` }"
                />
              </div>
              <div class="mt-2 text-xs opacity-70">
                {{ quota.usedTokens }} / {{ quota.dailyLimit }} used across
                {{ quota.requestCount }} requests today.
              </div>
            </div>
          </div>
        </template>
      </Card>

      <Card v-if="!canUseAgent" class="border border-amber-500/30 bg-amber-500/10 shadow-lg mb-6">
        <template #content>
          <h2 class="text-xl font-semibold">Restricted</h2>
          <p class="mt-2 text-sm leading-6 opacity-85">
            This page is available only to admins and operators because all requests spend tokens
            from a shared builder account.
          </p>
        </template>
      </Card>

      <template v-else>
        <div class="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(20rem,0.85fr)]">
          <Card class="shadow-lg">
            <template #content>
              <div class="flex items-center justify-between gap-3">
                <div>
                  <h2 class="text-xl font-semibold">Chat</h2>
                  <p class="text-sm opacity-75 mt-1">
                    Temporary math-only behavior. The final predefined agent can replace the backend
                    runner later without changing the page contract.
                  </p>
                </div>
                <Button
                  label="Refresh quota"
                  size="small"
                  severity="secondary"
                  outlined
                  @click="refreshQuota"
                  :loading="loading"
                />
              </div>

              <Divider class="my-4" />

              <div class="agent-thread rounded-2xl p-4">
                <div
                  v-for="(message, index) in messages"
                  :key="`${message.role}-${index}`"
                  class="flex"
                  :class="message.role === 'user' ? 'justify-end' : 'justify-start'"
                >
                  <div
                    class="agent-bubble"
                    :class="
                      message.role === 'user' ? 'agent-bubble--user' : 'agent-bubble--assistant'
                    "
                  >
                    <div class="text-[11px] uppercase tracking-[0.18em] opacity-55 mb-2">
                      {{ message.role === 'user' ? 'You' : 'Agent' }}
                    </div>
                    <div class="whitespace-pre-wrap text-sm leading-6">{{ message.content }}</div>
                  </div>
                </div>
              </div>

              <div class="mt-4 space-y-3">
                <textarea
                  v-model="input"
                  class="agent-input w-full rounded-2xl px-4 py-3 text-sm"
                  rows="5"
                  placeholder="Ask a math question. Example: calculate (125 + 75) / 4"
                  :disabled="loading || quota?.remainingTokens === 0"
                  @keydown.enter.exact.prevent="submitMessage"
                />

                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div class="flex flex-wrap gap-2">
                    <Button
                      v-for="prompt in examplePrompts"
                      :key="prompt"
                      size="small"
                      severity="secondary"
                      text
                      @click="useExamplePrompt(prompt)"
                    >
                      {{ prompt }}
                    </Button>
                  </div>

                  <Button
                    label="Send"
                    icon="pi pi-send"
                    :loading="loading"
                    :disabled="!input.trim() || quota?.remainingTokens === 0"
                    @click="submitMessage"
                  />
                </div>
              </div>
            </template>
          </Card>

          <div class="space-y-6">
            <Card class="shadow-lg">
              <template #content>
                <h2 class="text-lg font-semibold">Routing Model</h2>
                <Divider class="my-3" />
                <div class="space-y-3 text-sm leading-6 opacity-85">
                  <p>
                    Requests are scoped to the logged-in admin or operator, but spend budget from a
                    shared builder account.
                  </p>
                  <p>
                    The backend records daily per-user token usage, so one heavy user cannot consume
                    the full shared allowance silently.
                  </p>
                  <p>
                    The current server route is already separated from the page through a stable
                    API, so swapping in the final predefined agent is a backend change rather than a
                    UI rewrite.
                  </p>
                </div>
              </template>
            </Card>

            <Card class="shadow-lg">
              <template #content>
                <h2 class="text-lg font-semibold">Current Mode</h2>
                <Divider class="my-3" />
                <div class="flex flex-wrap gap-2 mb-3">
                  <Tag severity="warn" value="Math Only" />
                  <Tag
                    :severity="
                      agentMode.provider === 'copilot-sdk-auth-ready' ? 'info' : 'secondary'
                    "
                    :value="agentMode.provider"
                  />
                </div>
                <p class="text-sm leading-6 opacity-85">
                  The installed Copilot SDK package is currently used as the builder-tunnel
                  integration anchor, but the package only exposes authentication primitives. Until
                  the real predefined agent contract is supplied, this page stays on the safe
                  arithmetic fallback.
                </p>
              </template>
            </Card>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.agent-hero {
  border: 1px solid color-mix(in srgb, #1f6f78 24%, transparent);
  background:
    radial-gradient(circle at top left, rgba(16, 185, 129, 0.18), transparent 34%),
    radial-gradient(circle at bottom right, rgba(14, 116, 144, 0.22), transparent 38%),
    linear-gradient(135deg, rgba(247, 250, 252, 0.96), rgba(228, 244, 242, 0.96));
}

:global(.dark) .agent-hero {
  background:
    radial-gradient(circle at top left, rgba(16, 185, 129, 0.16), transparent 34%),
    radial-gradient(circle at bottom right, rgba(14, 116, 144, 0.2), transparent 38%),
    linear-gradient(135deg, rgba(12, 18, 24, 0.96), rgba(8, 27, 34, 0.96));
}

.agent-hero__glow {
  position: absolute;
  border-radius: 9999px;
  filter: blur(60px);
}

.agent-hero__glow--top {
  top: -5rem;
  right: -4rem;
  width: 14rem;
  height: 14rem;
  background: rgba(16, 185, 129, 0.18);
}

.agent-hero__glow--bottom {
  bottom: -6rem;
  left: -3rem;
  width: 16rem;
  height: 16rem;
  background: rgba(14, 116, 144, 0.14);
}

.agent-quota-card {
  min-width: 15rem;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(10px);
}

:global(.dark) .agent-quota-card {
  background: rgba(10, 18, 28, 0.72);
  border-color: rgba(148, 163, 184, 0.14);
}

.agent-quota-fill {
  height: 100%;
  border-radius: 9999px;
  transition: width 180ms ease;
}

.agent-quota-fill--success {
  background: linear-gradient(90deg, #0f766e, #14b8a6);
}

.agent-quota-fill--warn {
  background: linear-gradient(90deg, #b45309, #f59e0b);
}

.agent-quota-fill--danger {
  background: linear-gradient(90deg, #b91c1c, #ef4444);
}

.agent-thread {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 28rem;
  max-height: 38rem;
  overflow-y: auto;
  background:
    linear-gradient(180deg, rgba(15, 118, 110, 0.06), transparent 28%),
    color-mix(in srgb, var(--p-surface-100) 90%, transparent);
  border: 1px solid color-mix(in srgb, var(--p-surface-400) 22%, transparent);
}

:global(.dark) .agent-thread {
  background:
    linear-gradient(180deg, rgba(45, 212, 191, 0.08), transparent 28%), rgba(15, 23, 42, 0.78);
}

.agent-bubble {
  max-width: min(42rem, 90%);
  border-radius: 1.35rem;
  padding: 0.95rem 1rem;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
}

.agent-bubble--assistant {
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(15, 23, 42, 0.08);
}

.agent-bubble--user {
  background: linear-gradient(135deg, #0f766e, #155e75);
  color: white;
}

:global(.dark) .agent-bubble--assistant {
  background: rgba(15, 23, 42, 0.86);
  border-color: rgba(148, 163, 184, 0.16);
}

.agent-input {
  resize: vertical;
  border: 1px solid color-mix(in srgb, var(--p-surface-400) 30%, transparent);
  background: color-mix(in srgb, var(--p-surface-0) 88%, transparent);
}

:global(.dark) .agent-input {
  background: rgba(15, 23, 42, 0.86);
}

.agent-input:focus {
  outline: 2px solid rgba(20, 184, 166, 0.28);
  outline-offset: 1px;
}
</style>
