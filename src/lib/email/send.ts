import { getResendClient, EMAIL_FROM } from './resend'
import {
  ticketStatusChangedHtml,
  type TicketStatusChangedParams,
  dailyDigestHtml,
  type DailyDigestParams,
} from './templates'

interface SendResult {
  success: boolean
  id?: string
  error?: string
}

async function sendEmail(to: string, subject: string, html: string): Promise<SendResult> {
  const resend = getResendClient()
  if (!resend) {
    console.warn('[email] Resend nao configurado (RESEND_API_KEY ausente)')
    return { success: false, error: 'Resend nao configurado' }
  }

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      html,
    })

    if (error) {
      console.error('[email] Erro ao enviar:', error)
      return { success: false, error: error.message }
    }

    return { success: true, id: data?.id }
  } catch (err) {
    console.error('[email] Exceção:', err)
    return { success: false, error: String(err) }
  }
}

export async function sendTicketStatusChanged(
  to: string,
  params: TicketStatusChangedParams
): Promise<SendResult> {
  const subject = `[${params.ticketNumber}] Status alterado: ${params.newStatus === 'resolved' ? 'Resolvido' : params.newStatus === 'closed' ? 'Fechado' : 'Atualizado'}`
  return sendEmail(to, subject, ticketStatusChangedHtml(params))
}

export async function sendDailyDigest(
  to: string,
  params: DailyDigestParams
): Promise<SendResult> {
  const timeLabel = params.period === 'morning' ? 'Manha' : 'Tarde'
  const subject = `Resumo ${timeLabel} - ${params.totalOpen} tickets abertos`
  return sendEmail(to, subject, dailyDigestHtml(params))
}

export async function sendBatchEmails(
  recipients: { email: string; subject: string; html: string }[]
): Promise<{ sent: number; failed: number }> {
  let sent = 0
  let failed = 0

  // Send in batches of 10 (Resend rate limit friendly)
  for (let i = 0; i < recipients.length; i += 10) {
    const batch = recipients.slice(i, i + 10)
    const results = await Promise.allSettled(
      batch.map((r) => sendEmail(r.email, r.subject, r.html))
    )
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.success) {
        sent++
      } else {
        failed++
      }
    }
  }

  return { sent, failed }
}
