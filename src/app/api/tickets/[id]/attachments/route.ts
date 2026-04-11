import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
    }

    const { data: attachments, error } = await supabase
      .from('ticket_attachments')
      .select(
        '*, uploader:profiles!ticket_attachments_uploaded_by_fkey(id, full_name, avatar_url)'
      )
      .eq('ticket_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching attachments:', error)
      return NextResponse.json(
        { error: 'Erro ao buscar anexos' },
        { status: 500 }
      )
    }

    return NextResponse.json(attachments ?? [])
  } catch (err) {
    console.error(
      'Unexpected error in GET /api/tickets/[id]/attachments:',
      err
    )
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const commentId = formData.get('comment_id') as string | null

    if (!file) {
      return NextResponse.json(
        { error: 'Arquivo e obrigatorio' },
        { status: 400 }
      )
    }

    // Max 10MB
    const MAX_FILE_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Arquivo deve ter no maximo 10MB' },
        { status: 400 }
      )
    }

    // Upload to Supabase Storage
    const fileExtension = file.name.split('.').pop() ?? 'bin'
    const filePath = `tickets/${id}/${Date.now()}-${crypto.randomUUID()}.${fileExtension}`

    const arrayBuffer = await file.arrayBuffer()
    const fileBuffer = new Uint8Array(arrayBuffer)

    const { error: uploadError } = await supabase.storage
      .from('ticket-attachments')
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Error uploading file:', uploadError)
      return NextResponse.json(
        { error: 'Erro ao fazer upload do arquivo' },
        { status: 500 }
      )
    }

    // Create attachment record
    const { data: attachment, error: insertError } = await supabase
      .from('ticket_attachments')
      .insert({
        ticket_id: id,
        comment_id: commentId || null,
        uploaded_by: user.id,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type,
      })
      .select(
        '*, uploader:profiles!ticket_attachments_uploaded_by_fkey(id, full_name, avatar_url)'
      )
      .single()

    if (insertError) {
      console.error('Error creating attachment record:', insertError)
      // Try to clean up uploaded file
      await supabase.storage.from('ticket-attachments').remove([filePath])
      return NextResponse.json(
        { error: 'Erro ao registrar anexo' },
        { status: 500 }
      )
    }

    return NextResponse.json(attachment, { status: 201 })
  } catch (err) {
    console.error(
      'Unexpected error in POST /api/tickets/[id]/attachments:',
      err
    )
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
