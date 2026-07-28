export function setCookie(name: string, val: string | object) {
  const date = new Date()
  const value = typeof val === 'string' ? val : JSON.stringify(val)

  // Set it expire in 7 days
  date.setTime(date.getTime() + 7 * 24 * 60 * 60 * 1000)

  // Set it
  document.cookie = name + '=' + value + '; expires=' + date.toUTCString() + '; path=/'
}

export function getCookie(name: string): string | object | undefined {
  const value = '; ' + document.cookie
  const parts = value.split('; ' + name + '=')

  if (parts.length == 2) {
    const rawValue = parts.pop()?.split(';').shift()
    if (rawValue === undefined) {
      return undefined
    }

    try {
      return JSON.parse(rawValue)
    } catch {
      return rawValue
    }
  }
}

export function deleteCookie(name: string) {
  const date = new Date()

  // Set it expire in -1 days
  date.setTime(date.getTime() + -1 * 24 * 60 * 60 * 1000)

  // Set it
  document.cookie = name + '=; expires=' + date.toUTCString() + '; path=/'
}
