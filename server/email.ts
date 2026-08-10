type BookingCreatedEmailPayload = {
  to: string
  username?: string | null
  testwallName: string
  fromTime: string
  toTime: string
  bookingId: number
}

type MailTransporter = {
  sendMail: (mailOptions: {
    from: string
    to: string
    subject: string
    text: string
  }) => Promise<unknown>
}

let transporter: MailTransporter | null = null
let emailConfigWarned = false
let emailDependencyWarned = false

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback
  }

  const normalized = value.trim().toLowerCase()
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true
  }

  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false
  }

  return fallback
}

function getMailerConfig() {
  const host = process.env.SMTP_HOST?.trim()
  const from = process.env.EMAIL_FROM?.trim()

  if (!host || !from) {
    if (!emailConfigWarned) {
      console.warn(
        'Email notifications are disabled. Set SMTP_HOST and EMAIL_FROM to enable booking emails.',
      )
      emailConfigWarned = true
    }
    return null
  }

  const port = Number(process.env.SMTP_PORT ?? 587)
  const secure = parseBoolean(process.env.SMTP_SECURE, false)
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS?.trim()

  return {
    host,
    from,
    port: Number.isFinite(port) ? port : 587,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  }
}

export function isBookingEmailEnabled(): boolean {
  return getMailerConfig() !== null
}

async function getTransporter(): Promise<MailTransporter | null> {
  if (transporter) {
    return transporter
  }

  const config = getMailerConfig()
  if (!config) {
    return null
  }

  let createTransport: ((options: unknown) => MailTransporter) | null = null

  try {
    const nodemailerModule = (await import('nodemailer')) as any
    createTransport =
      typeof nodemailerModule?.default?.createTransport === 'function'
        ? nodemailerModule.default.createTransport
        : typeof nodemailerModule?.createTransport === 'function'
          ? nodemailerModule.createTransport
          : null
  } catch (error) {
    if (!emailDependencyWarned) {
      console.warn(
        'Email notifications are disabled because nodemailer is unavailable. Install dependencies to enable booking emails.',
      )
      emailDependencyWarned = true
    }
    console.warn('nodemailer import error:', error)
    return null
  }

  if (!createTransport) {
    console.warn('Email notifications are disabled because nodemailer createTransport is missing.')
    return null
  }

  transporter = createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  })

  return transporter
}

function formatBookingDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return `${date.toLocaleString()} (local time)`
}

export async function sendBookingCreatedEmail(
  payload: BookingCreatedEmailPayload,
): Promise<boolean> {
  const config = getMailerConfig()
  const mailer = await getTransporter()
  if (!config || !mailer) {
    return false
  }

  const greeting = payload.username?.trim() ? `Hi ${payload.username.trim()},` : 'Hi,'

  const subject = `Booking confirmation #${payload.bookingId}`
  const text = [
    greeting,
    '',
    'Your booking has been created successfully.',
    '',
    `Booking ID: ${payload.bookingId}`,
    `Testwall: ${payload.testwallName}`,
    `Start: ${formatBookingDate(payload.fromTime)}`,
    `End: ${formatBookingDate(payload.toTime)}`,
    '',
    'If this was not expected, please contact an administrator.',
  ].join('\n')

  await mailer.sendMail({
    from: config.from,
    to: payload.to,
    subject,
    text,
  })

  return true
}
