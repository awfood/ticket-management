// Email HTML templates for Resend

const COLORS = {
  primary: '#18181b',
  muted: '#71717a',
  border: '#e4e4e7',
  bg: '#fafafa',
  white: '#ffffff',
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#eab308',
  orange: '#f97316',
  red: '#ef4444',
  purple: '#a855f7',
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  open: { label: 'Aberto', color: COLORS.blue },
  in_progress: { label: 'Em andamento', color: COLORS.yellow },
  waiting_client: { label: 'Aguardando cliente', color: COLORS.orange },
  waiting_internal: { label: 'Aguardando interno', color: COLORS.purple },
  resolved: { label: 'Resolvido', color: COLORS.green },
  closed: { label: 'Fechado', color: COLORS.muted },
  cancelled: { label: 'Cancelado', color: COLORS.red },
}

const PRIORITY_LABELS: Record<string, string> = {
  critical: 'Critico',
  high: 'Alto',
  medium: 'Medio',
  low: 'Baixo',
}

function baseLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${COLORS.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
    <div style="text-align:center;padding:16px 0;margin-bottom:24px;">
      <span style="font-size:18px;font-weight:700;color:${COLORS.primary};">AW</span>
      <span style="font-size:18px;font-weight:400;color:${COLORS.muted};">Food Suporte</span>
    </div>
    <div style="background:${COLORS.white};border:1px solid ${COLORS.border};border-radius:8px;padding:24px;">
      ${content}
    </div>
    <div style="text-align:center;padding:16px 0;margin-top:24px;">
      <p style="font-size:12px;color:${COLORS.muted};margin:0;">AWFood Suporte &mdash; Plataforma de Gerenciamento de Tickets</p>
    </div>
  </div>
</body>
</html>`
}

function statusBadge(status: string): string {
  const s = STATUS_LABELS[status] ?? { label: status, color: COLORS.muted }
  return `<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;color:#fff;background:${s.color};">${s.label}</span>`
}

// -----------------------------------------------------------
// 1. Ticket Status Changed Email
// -----------------------------------------------------------
export interface TicketStatusChangedParams {
  recipientName: string
  ticketNumber: string
  ticketTitle: string
  oldStatus: string
  newStatus: string
  changedBy: string
  ticketUrl: string
}

export function ticketStatusChangedHtml(p: TicketStatusChangedParams): string {
  return baseLayout(`
    <h2 style="margin:0 0 4px;font-size:16px;color:${COLORS.primary};">Atualizacao de status</h2>
    <p style="margin:0 0 16px;font-size:14px;color:${COLORS.muted};">
      Ola ${p.recipientName}, o ticket <strong>${p.ticketNumber}</strong> teve o status atualizado.
    </p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <tr>
        <td style="padding:8px 0;font-size:13px;color:${COLORS.muted};width:120px;">Ticket</td>
        <td style="padding:8px 0;font-size:13px;font-weight:600;">${p.ticketNumber} &mdash; ${p.ticketTitle}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-size:13px;color:${COLORS.muted};">Status anterior</td>
        <td style="padding:8px 0;">${statusBadge(p.oldStatus)}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-size:13px;color:${COLORS.muted};">Novo status</td>
        <td style="padding:8px 0;">${statusBadge(p.newStatus)}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-size:13px;color:${COLORS.muted};">Alterado por</td>
        <td style="padding:8px 0;font-size:13px;">${p.changedBy}</td>
      </tr>
    </table>
    <a href="${p.ticketUrl}" style="display:inline-block;padding:10px 20px;background:${COLORS.primary};color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;">Ver ticket</a>
  `)
}

// -----------------------------------------------------------
// 2. Daily Digest Email
// -----------------------------------------------------------
export interface DigestTicketRow {
  ticket_number: string
  title: string
  status: string
  priority: string
  org_name?: string
  url: string
}

export interface DailyDigestParams {
  recipientName: string
  period: 'morning' | 'afternoon'
  // Stats
  totalOpen: number
  totalInProgress: number
  totalWaitingClient: number
  totalWaitingInternal: number
  // Morning specific
  ticketsDueToday?: DigestTicketRow[]
  // Afternoon specific
  ticketsOpenedToday?: number
  ticketsClosedToday?: number
  // Ticket lists
  assignedTickets: DigestTicketRow[]
  urgentTickets: DigestTicketRow[]
  // Admin only
  isAdmin: boolean
  totalAllOpen?: number
  slaBreachCount?: number
  unassignedCount?: number
}

function ticketTable(rows: DigestTicketRow[], title: string): string {
  if (rows.length === 0) return ''
  const headerRow = `<tr style="background:${COLORS.bg};">
    <th style="padding:8px;font-size:12px;text-align:left;color:${COLORS.muted};font-weight:600;">Ticket</th>
    <th style="padding:8px;font-size:12px;text-align:left;color:${COLORS.muted};font-weight:600;">Titulo</th>
    <th style="padding:8px;font-size:12px;text-align:left;color:${COLORS.muted};font-weight:600;">Status</th>
    <th style="padding:8px;font-size:12px;text-align:left;color:${COLORS.muted};font-weight:600;">Prioridade</th>
  </tr>`
  const bodyRows = rows.slice(0, 15).map((r) => `<tr style="border-bottom:1px solid ${COLORS.border};">
    <td style="padding:8px;font-size:13px;"><a href="${r.url}" style="color:${COLORS.blue};text-decoration:none;font-weight:500;">${r.ticket_number}</a></td>
    <td style="padding:8px;font-size:13px;">${r.title.length > 50 ? r.title.slice(0, 50) + '...' : r.title}</td>
    <td style="padding:8px;">${statusBadge(r.status)}</td>
    <td style="padding:8px;font-size:13px;">${PRIORITY_LABELS[r.priority] ?? r.priority}</td>
  </tr>`).join('')
  const overflow = rows.length > 15 ? `<p style="font-size:12px;color:${COLORS.muted};margin:8px 0 0;">+ ${rows.length - 15} tickets adicionais</p>` : ''
  return `<h3 style="margin:20px 0 8px;font-size:14px;color:${COLORS.primary};">${title}</h3>
  <table style="width:100%;border-collapse:collapse;border:1px solid ${COLORS.border};border-radius:6px;">
    ${headerRow}${bodyRows}
  </table>${overflow}`
}

function statCard(label: string, value: number | string, color: string): string {
  return `<td style="padding:12px;text-align:center;background:${COLORS.white};border:1px solid ${COLORS.border};border-radius:6px;">
    <div style="font-size:24px;font-weight:700;color:${color};">${value}</div>
    <div style="font-size:11px;color:${COLORS.muted};margin-top:2px;">${label}</div>
  </td>`
}

export function dailyDigestHtml(p: DailyDigestParams): string {
  const greeting = p.period === 'morning'
    ? `Bom dia, ${p.recipientName}! Aqui esta o resumo para iniciar o dia.`
    : `Boa tarde, ${p.recipientName}! Aqui esta o resumo do dia.`

  const title = p.period === 'morning' ? 'Resumo da Manha' : 'Resumo da Tarde'

  let stats = `
    <table style="width:100%;border-collapse:separate;border-spacing:8px 0;margin-bottom:16px;">
      <tr>
        ${statCard('Abertos', p.totalOpen, COLORS.blue)}
        ${statCard('Em progresso', p.totalInProgress, COLORS.yellow)}
        ${statCard('Aguardando', p.totalWaitingClient + p.totalWaitingInternal, COLORS.orange)}
      </tr>
    </table>`

  if (p.period === 'afternoon') {
    stats += `<table style="width:100%;border-collapse:separate;border-spacing:8px 0;margin-bottom:16px;">
      <tr>
        ${statCard('Abertos hoje', p.ticketsOpenedToday ?? 0, COLORS.blue)}
        ${statCard('Finalizados hoje', p.ticketsClosedToday ?? 0, COLORS.green)}
      </tr>
    </table>`
  }

  let adminSection = ''
  if (p.isAdmin) {
    adminSection = `
    <div style="margin-top:16px;padding:12px;background:#fef3c7;border:1px solid #fde68a;border-radius:6px;">
      <h3 style="margin:0 0 8px;font-size:13px;color:#92400e;">Visao geral (administrador)</h3>
      <p style="font-size:13px;color:#78350f;margin:0;">
        Total abertos: <strong>${p.totalAllOpen ?? p.totalOpen}</strong> &bull;
        SLA em risco: <strong>${p.slaBreachCount ?? 0}</strong> &bull;
        Sem atribuicao: <strong>${p.unassignedCount ?? 0}</strong>
      </p>
    </div>`
  }

  const dueSection = p.period === 'morning' && p.ticketsDueToday
    ? ticketTable(p.ticketsDueToday, 'Tickets com prazo para hoje')
    : ''

  return baseLayout(`
    <h2 style="margin:0 0 4px;font-size:16px;color:${COLORS.primary};">${title}</h2>
    <p style="margin:0 0 16px;font-size:14px;color:${COLORS.muted};">${greeting}</p>
    ${stats}
    ${adminSection}
    ${dueSection}
    ${ticketTable(p.urgentTickets, 'Tickets urgentes (critico/alto)')}
    ${ticketTable(p.assignedTickets, 'Seus tickets atribuidos')}
    <div style="text-align:center;margin-top:20px;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/tickets" style="display:inline-block;padding:10px 20px;background:${COLORS.primary};color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;">Abrir painel</a>
    </div>
  `)
}

// -----------------------------------------------------------
// 3. Invite Email
// -----------------------------------------------------------
export interface InviteEmailParams {
  recipientName: string
  recipientEmail: string
  orgName: string
  inviterName: string
  role: string
  inviteLink: string
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Administrador',
  admin: 'Administrador',
  agent: 'Agente',
  viewer: 'Visualizador',
  org_admin: 'Administrador da Organizacao',
  org_member: 'Membro',
}

export function inviteEmailHtml(p: InviteEmailParams): string {
  const roleLabel = ROLE_LABELS[p.role] ?? p.role
  return baseLayout(`
    <h2 style="margin:0 0 4px;font-size:16px;color:${COLORS.primary};">Voce foi convidado!</h2>
    <p style="margin:0 0 16px;font-size:14px;color:${COLORS.muted};">
      Ola ${p.recipientName}, <strong>${p.inviterName}</strong> convidou voce para acessar a plataforma de suporte da AWFood.
    </p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr>
        <td style="padding:8px 0;font-size:13px;color:${COLORS.muted};width:120px;">Organizacao</td>
        <td style="padding:8px 0;font-size:13px;font-weight:600;">${p.orgName}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-size:13px;color:${COLORS.muted};">Perfil</td>
        <td style="padding:8px 0;font-size:13px;font-weight:600;">${roleLabel}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-size:13px;color:${COLORS.muted};">Email</td>
        <td style="padding:8px 0;font-size:13px;">${p.recipientEmail}</td>
      </tr>
    </table>
    <div style="text-align:center;margin:24px 0 16px;">
      <a href="${p.inviteLink}" style="display:inline-block;padding:12px 32px;background:${COLORS.primary};color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">Aceitar convite</a>
    </div>
    <p style="font-size:12px;color:${COLORS.muted};text-align:center;margin:0;">
      Se voce nao esperava receber este convite, pode ignorar este email.
    </p>
  `)
}
