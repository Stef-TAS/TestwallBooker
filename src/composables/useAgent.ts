import { ref } from 'vue'

export type AgentChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type AgentQuota = {
  dailyLimit: number
  usedTokens: number
  remainingTokens: number
  requestCount: number
  builderAccount: string
}

export type AgentModeInfo = {
  mode: 'math-only'
  provider: 'math-fallback' | 'copilot-sdk-auth-ready'
  builderTunnelReady: boolean
}

export function useAgent() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function getQuota(): Promise<AgentQuota | null> {
    loading.value = true
    error.value = null

    try {
      const res = await fetch('/api/agent/quota')
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch agent quota')
      }

      return data as AgentQuota
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return null
    } finally {
      loading.value = false
    }
  }

  async function sendMessage(input: {
    message: string
    history: AgentChatMessage[]
  }): Promise<{ message: AgentChatMessage; quota: AgentQuota; agent: AgentModeInfo } | null> {
    loading.value = true
    error.value = null

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send agent message')
      }

      return data as { message: AgentChatMessage; quota: AgentQuota; agent: AgentModeInfo }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return null
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,
    getQuota,
    sendMessage,
  }
}
