import { Headset } from 'lucide-react'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-4 py-12">
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Headset className="size-6" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">
          AWFood Suporte
        </h1>
        <p className="text-sm text-muted-foreground">
          Sistema de gerenciamento de tickets
        </p>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  )
}
