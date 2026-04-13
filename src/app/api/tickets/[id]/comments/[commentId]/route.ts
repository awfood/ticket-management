import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/auth-helpers'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const { id, commentId } = await params
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
    }

    if (user.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Apenas super_admin pode excluir comentarios' },
        { status: 403 }
      )
    }

    const serviceClient = await createServiceClient()

    const { data: comment } = await serviceClient
      .from('ticket_comments')
      .select('id')
      .eq('id', commentId)
      .eq('ticket_id', id)
      .is('deleted_at', null)
      .single()

    if (!comment) {
      return NextResponse.json({ error: 'Comentario nao encontrado' }, { status: 404 })
    }

    const { error } = await serviceClient
      .from('ticket_comments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', commentId)

    if (error) {
      console.error('Error deleting comment:', error)
      return NextResponse.json({ error: 'Erro ao excluir comentario' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Comentario excluido com sucesso' })
  } catch (err) {
    console.error('Unexpected error in DELETE /api/tickets/[id]/comments/[commentId]:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
