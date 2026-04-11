import { TicketForm } from '@/components/tickets/ticket-form'

export default function NewTicketPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Novo Ticket</h1>
        <p className="text-sm text-muted-foreground">
          Preencha as informacoes abaixo para abrir um novo ticket de suporte.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <TicketForm />
      </div>
    </div>
  )
}
