'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { CircleCheck, Loader2, UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const registerSchema = z
  .object({
    full_name: z
      .string()
      .min(1, 'O nome completo e obrigatorio')
      .min(3, 'O nome deve ter pelo menos 3 caracteres'),
    email: z
      .string()
      .min(1, 'O e-mail e obrigatorio')
      .email('Informe um e-mail valido'),
    password: z
      .string()
      .min(1, 'A senha e obrigatoria')
      .min(6, 'A senha deve ter pelo menos 6 caracteres'),
    confirm_password: z.string().min(1, 'Confirme sua senha'),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'As senhas nao correspondem',
    path: ['confirm_password'],
  })

type RegisterFormData = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    defaultValues: {
      full_name: '',
      email: '',
      password: '',
      confirm_password: '',
    },
  })

  async function onSubmit(data: RegisterFormData) {
    const parsed = registerSchema.safeParse(data)
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }

    setIsLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.full_name,
        },
      },
    })

    setIsLoading(false)

    if (authError) {
      if (authError.message.includes('already registered')) {
        setError('Este e-mail ja esta cadastrado')
      } else {
        setError('Ocorreu um erro ao criar a conta. Tente novamente.')
      }
      return
    }

    setIsSuccess(true)
  }

  if (isSuccess) {
    return (
      <Card>
        <CardHeader>
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10">
            <CircleCheck className="size-6 text-primary" />
          </div>
          <CardTitle className="text-center">Conta criada</CardTitle>
          <CardDescription className="text-center">
            Enviamos um link de confirmacao para o seu e-mail. Verifique sua
            caixa de entrada para ativar sua conta.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Link
            href="/login"
            className="text-sm font-medium text-foreground hover:underline"
          >
            Voltar para o login
          </Link>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Criar conta</CardTitle>
        <CardDescription>
          Preencha os dados abaixo para se cadastrar
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="flex flex-col gap-4">
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="full_name">Nome completo</Label>
            <Input
              id="full_name"
              type="text"
              placeholder="Seu nome completo"
              autoComplete="name"
              aria-invalid={!!errors.full_name}
              {...register('full_name')}
            />
            {errors.full_name && (
              <p className="text-xs text-destructive">
                {errors.full_name.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              autoComplete="email"
              aria-invalid={!!errors.email}
              {...register('email')}
            />
            {errors.email && (
              <p className="text-xs text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="Minimo 6 caracteres"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              {...register('password')}
            />
            {errors.password && (
              <p className="text-xs text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm_password">Confirmar senha</Label>
            <Input
              id="confirm_password"
              type="password"
              placeholder="Repita a senha"
              autoComplete="new-password"
              aria-invalid={!!errors.confirm_password}
              {...register('confirm_password')}
            />
            {errors.confirm_password && (
              <p className="text-xs text-destructive">
                {errors.confirm_password.message}
              </p>
            )}
          </div>

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UserPlus className="size-4" />
            )}
            {isLoading ? 'Criando conta...' : 'Criar conta'}
          </Button>
        </CardContent>
      </form>
      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          Ja tem uma conta?{' '}
          <Link
            href="/login"
            className="font-medium text-foreground hover:underline"
          >
            Entrar
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
