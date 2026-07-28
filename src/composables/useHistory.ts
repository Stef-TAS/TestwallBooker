import { useAccountStore } from '@/stores/account'

export function useHistory() {
  const accountStore = useAccountStore()

  async function saveCommand(command: string): Promise<void> {
    const user_id = accountStore.account?.id
    if (!user_id) return
    await fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id, command }),
    })
  }

  async function loadHistory(): Promise<string[]> {
    const user_id = accountStore.account?.id
    if (!user_id) return []
    const res = await fetch(`/api/history/${user_id}`)
    if (!res.ok) return []
    const data = (await res.json()) as { command: string }[]
    return data.map((row) => row.command)
  }

  async function log(action: string, details?: string): Promise<void> {
    const user_id = accountStore.account?.id
    await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user_id ?? null, action, details }),
    })
  }

  return { saveCommand, loadHistory, log }
}
