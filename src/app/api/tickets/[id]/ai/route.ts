import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAIProvider } from '@/lib/ai/provider'
import { analyzeTicket, analyzeComment } from '@/lib/ai/ticket-analyzer'
import { generateDevPrompt } from '@/lib/ai/dev-prompt-generator'
import { findSimilarTickets, generateEmbedding } from '@/lib/ai/similar-finder'
import { decrypt } from '@/lib/integrations/encryption'
import type { AIProvider } from '@/types'

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

    // Check request type
    const body = await request.json().catch(() => ({}))
    const requestBody = body as Record<string, unknown>
    const commentId = requestBody.comment_id as string | undefined
    const isDevPrompt = requestBody.type === 'dev_prompt'
    const devPromptExtraNotes = requestBody.extra_notes as string | undefined
    const devPromptAiHasContext = requestBody.ai_has_context as boolean | undefined

    // Fetch ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (ticketError || !ticket) {
      return NextResponse.json(
        { error: 'Ticket nao encontrado' },
        { status: 404 }
      )
    }

    // Fetch AI settings
    const { data: aiSettings, error: settingsError } = await supabase
      .from('ai_settings')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (settingsError || !aiSettings) {
      return NextResponse.json(
        { error: 'Configuracoes de IA nao encontradas ou inativas' },
        { status: 400 }
      )
    }

    // Decrypt API key and create provider
    let apiKey: string
    try {
      apiKey = decrypt(aiSettings.api_key_encrypted)
    } catch {
      return NextResponse.json(
        { error: 'Erro ao descriptografar chave de API da IA' },
        { status: 500 }
      )
    }

    const provider = createAIProvider(
      aiSettings.provider as AIProvider,
      apiKey
    )

    // ── Dev Prompt Generation ──
    if (isDevPrompt) {
      // Check ai.dev_prompt permission
      const { data: userMembership } = await supabase
        .from('org_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('is_active', true)

      const userRoles = (userMembership ?? []).map((m) => m.role)

      // super_admin always has access
      if (!userRoles.includes('super_admin')) {
        const { data: devPerm } = await supabase
          .from('role_permissions')
          .select('role, permission:permissions!inner(name)')
          .eq('permission.name', 'ai.dev_prompt')

        const allowedRoles = (devPerm ?? []).map((rp) => rp.role)
        const hasDevPermission = userRoles.some((r) => allowedRoles.includes(r))

        if (!hasDevPermission) {
          return NextResponse.json(
            { error: 'Permissao ai.dev_prompt necessaria' },
            { status: 403 }
          )
        }
      }

      // Fetch comments for context
      const { data: devComments } = await supabase
        .from('ticket_comments')
        .select('body, is_internal, author:profiles!ticket_comments_author_id_fkey(full_name)')
        .eq('ticket_id', id)
        .is('deleted_at', null)
        .neq('comment_type', 'ai_analysis')
        .order('created_at', { ascending: true })
        .limit(20)

      // Get previous analysis for context
      const { data: prevDevAnalysis } = await supabase
        .from('ai_analysis_results')
        .select('result')
        .eq('ticket_id', id)
        .eq('analysis_type', 'full_diagnosis')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const devPromptResult = await generateDevPrompt(
        {
          ticket_number: ticket.ticket_number,
          title: ticket.title,
          description: ticket.description,
          category: ticket.category,
          affected_service: ticket.affected_service,
          environment: ticket.environment,
          impact: ticket.impact,
          steps_to_reproduce: ticket.steps_to_reproduce,
          expected_behavior: ticket.expected_behavior,
          actual_behavior: ticket.actual_behavior,
          comments: (devComments ?? []).map((c) => ({
            author: ((c.author as unknown as { full_name: string } | null))?.full_name ?? 'Desconhecido',
            body: c.body,
            is_internal: c.is_internal,
          })),
          previousAnalysis: prevDevAnalysis?.result
            ? String((prevDevAnalysis.result as Record<string, unknown>).diagnosis ?? '')
            : undefined,
        },
        provider,
        {
          extra_notes: devPromptExtraNotes,
          ai_has_context: devPromptAiHasContext,
        }
      )

      // Store result
      await supabase.from('ai_analysis_results').insert({
        ticket_id: id,
        analysis_type: 'dev_prompt',
        result: devPromptResult as unknown as Record<string, unknown>,
        model_used: devPromptResult.model_used,
        tokens_used: devPromptResult.tokens_used,
        cost_usd: null,
        created_by: user.id,
      })

      // Save as ai_dev_prompt note (internal, visible only to devs)
      const { error: commentError } = await supabase.from('ticket_comments').insert({
        ticket_id: id,
        author_id: user.id,
        body: `**Prompt de Desenvolvimento Gerado**\n\n${devPromptResult.prompt}`,
        body_html: formatDevPromptAsHtml(devPromptResult, {
          extra_notes: devPromptExtraNotes,
          ai_has_context: devPromptAiHasContext,
        }),
        is_internal: true,
        comment_type: 'ai_dev_prompt',
        metadata: {
          affected_files: devPromptResult.affected_files,
          approach_steps: devPromptResult.approach_steps,
          test_suggestions: devPromptResult.test_suggestions,
          extra_notes: devPromptExtraNotes || null,
          ai_has_context: devPromptAiHasContext ?? false,
        },
      })

      if (commentError) {
        console.error('[ai] Erro ao salvar nota de prompt:', commentError)
      }

      return NextResponse.json({ dev_prompt: devPromptResult, saved_as_comment: !commentError })
    }

    // ── Comment-specific analysis ──
    if (commentId) {
      const { data: targetComment } = await supabase
        .from('ticket_comments')
        .select('id, body, is_internal, created_at, author:profiles!ticket_comments_author_id_fkey(full_name)')
        .eq('id', commentId)
        .single()

      if (!targetComment) {
        return NextResponse.json({ error: 'Comentario nao encontrado' }, { status: 404 })
      }

      // Get prior comments for context
      const { data: priorComments } = await supabase
        .from('ticket_comments')
        .select('body, author:profiles!ticket_comments_author_id_fkey(full_name)')
        .eq('ticket_id', id)
        .is('deleted_at', null)
        .lt('created_at', targetComment.created_at)
        .order('created_at', { ascending: true })
        .limit(10)

      const commentAnalysis = await analyzeComment(
        { title: ticket.title, description: ticket.description, status: ticket.status },
        {
          body: targetComment.body,
          author: ((targetComment.author as unknown as { full_name: string } | null))?.full_name ?? 'Desconhecido',
          is_internal: targetComment.is_internal,
        },
        (priorComments ?? []).map((c) => ({
          author: ((c.author as unknown as { full_name: string } | null))?.full_name ?? 'Desconhecido',
          body: c.body,
        })),
        provider
      )

      // Store result
      await supabase.from('ai_analysis_results').insert({
        ticket_id: id,
        analysis_type: 'comment_analysis',
        result: { ...commentAnalysis, comment_id: commentId } as unknown as Record<string, unknown>,
        model_used: aiSettings.default_model ?? aiSettings.provider,
        tokens_used: null,
        cost_usd: null,
        created_by: user.id,
      })

      return NextResponse.json({ comment_analysis: commentAnalysis, comment_id: commentId })
    }

    // ── Full ticket analysis (incremental) ──

    // Fetch comments for incremental analysis
    const { data: comments } = await supabase
      .from('ticket_comments')
      .select('body, is_internal, created_at, author:profiles!ticket_comments_author_id_fkey(full_name)')
      .eq('ticket_id', id)
      .is('deleted_at', null)
      .neq('comment_type', 'ai_analysis')
      .order('created_at', { ascending: true })
      .limit(30)

    const commentsList = (comments ?? []).map((c) => ({
      author: ((c.author as unknown as { full_name: string } | null))?.full_name ?? 'Desconhecido',
      body: c.body,
      created_at: c.created_at,
      is_internal: c.is_internal,
    }))

    // Fetch previous analysis for incremental context
    const { data: prevAnalysis } = await supabase
      .from('ai_analysis_results')
      .select('result')
      .eq('ticket_id', id)
      .eq('analysis_type', 'full_diagnosis')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const previousDiagnosis = prevAnalysis?.result
      ? String((prevAnalysis.result as Record<string, unknown>).diagnosis ?? '')
      : undefined

    // Run analysis with full context
    const analysis = await analyzeTicket(
      {
        title: ticket.title,
        description: ticket.description,
        category: ticket.category ?? undefined,
        affected_service: ticket.affected_service ?? undefined,
        comments: commentsList.length > 0 ? commentsList : undefined,
        previousAnalysis: previousDiagnosis,
      },
      { provider }
    )

    // Try to generate embedding and find similar tickets
    let similarTickets: Awaited<ReturnType<typeof findSimilarTickets>> = []
    try {
      const embeddingText = `${ticket.title}\n${ticket.description}`
      const openaiKey = process.env.OPENAI_API_KEY
      if (openaiKey) {
        const embedding = await generateEmbedding(embeddingText, openaiKey)

        // Store embedding on the ticket
        await supabase
          .from('tickets')
          .update({ embedding })
          .eq('id', id)

        similarTickets = await findSimilarTickets(supabase, embedding)
        // Exclude self from similar tickets
        similarTickets = similarTickets.filter((t) => t.id !== id)
      }
    } catch (embeddingError) {
      console.error('Error generating embedding or finding similar tickets:', embeddingError)
      // Non-fatal: continue with analysis results
    }

    // Store analysis result
    const { data: analysisResult, error: insertError } = await supabase
      .from('ai_analysis_results')
      .insert({
        ticket_id: id,
        analysis_type: 'full_diagnosis',
        result: analysis as unknown as Record<string, unknown>,
        model_used: aiSettings.default_model ?? aiSettings.provider,
        tokens_used: null,
        cost_usd: null,
        created_by: user.id,
      })
      .select('*')
      .single()

    if (insertError) {
      console.error('Error storing analysis result:', insertError)
      // Non-fatal: return analysis even if storage fails
    }

    // Also add a system comment with the analysis
    await supabase.from('ticket_comments').insert({
      ticket_id: id,
      author_id: user.id,
      body: formatAnalysisAsComment(analysis),
      is_internal: true,
      comment_type: 'ai_analysis',
      metadata: { analysis_id: analysisResult?.id },
    })

    return NextResponse.json({
      analysis,
      similar_tickets: similarTickets,
      analysis_id: analysisResult?.id,
    })
  } catch (err) {
    console.error('Unexpected error in POST /api/tickets/[id]/ai:', err)
    const message =
      err instanceof Error ? err.message : 'Erro interno do servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function formatAnalysisAsComment(
  analysis: Awaited<ReturnType<typeof analyzeTicket>>
): string {
  const parts: string[] = []
  parts.push(`**Diagnostico IA:** ${analysis.diagnosis}`)
  parts.push('')

  if (analysis.possibleCauses.length > 0) {
    parts.push('**Possiveis causas:**')
    for (const cause of analysis.possibleCauses) {
      parts.push(`- ${cause}`)
    }
    parts.push('')
  }

  if (analysis.suggestedActions.forClient.length > 0) {
    parts.push('**Acoes sugeridas para o cliente:**')
    for (const action of analysis.suggestedActions.forClient) {
      parts.push(`- ${action}`)
    }
    parts.push('')
  }

  if (analysis.suggestedActions.forDevelopment.length > 0) {
    parts.push('**Acoes sugeridas para desenvolvimento:**')
    for (const action of analysis.suggestedActions.forDevelopment) {
      parts.push(`- ${action}`)
    }
    parts.push('')
  }

  parts.push(
    `Categoria sugerida: ${analysis.suggestedCategory} | Prioridade: ${analysis.suggestedPriority} | Servico: ${analysis.suggestedService} | Confianca: ${Math.round(analysis.confidence * 100)}%`
  )

  return parts.join('\n')
}

function formatDevPromptAsHtml(
  result: Awaited<ReturnType<typeof generateDevPrompt>>,
  opts?: { extra_notes?: string; ai_has_context?: boolean }
): string {
  const sections: string[] = []
  sections.push('<h3>Prompt de Desenvolvimento</h3>')

  // Badges de configuracao
  const badges: string[] = []
  if (opts?.ai_has_context) {
    badges.push('<span style="display:inline-block;background:#059669;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;margin-right:6px;">IA com contexto previo</span>')
  } else {
    badges.push('<span style="display:inline-block;background:#6366f1;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;margin-right:6px;">Prompt completo</span>')
  }
  sections.push(`<p>${badges.join('')}</p>`)

  // Observacoes extras do dev
  if (opts?.extra_notes) {
    sections.push(`<div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:6px;padding:8px 12px;margin-bottom:8px;font-size:13px;"><strong>Observacoes do dev:</strong> ${escapeHtml(opts.extra_notes)}</div>`)
  }

  sections.push(`<pre style="white-space:pre-wrap;background:#1e1e2e;color:#cdd6f4;padding:12px;border-radius:6px;font-size:13px;line-height:1.5;overflow-x:auto;">${escapeHtml(result.prompt)}</pre>`)

  if (result.affected_files.length > 0) {
    sections.push('<h4>Arquivos afetados</h4>')
    sections.push('<ul>' + result.affected_files.map((f) => `<li><code>${escapeHtml(f)}</code></li>`).join('') + '</ul>')
  }
  if (result.approach_steps.length > 0) {
    sections.push('<h4>Abordagem</h4>')
    sections.push('<ol>' + result.approach_steps.map((s) => `<li>${escapeHtml(s)}</li>`).join('') + '</ol>')
  }
  if (result.test_suggestions.length > 0) {
    sections.push('<h4>Sugestoes de teste</h4>')
    sections.push('<ul>' + result.test_suggestions.map((t) => `<li>${escapeHtml(t)}</li>`).join('') + '</ul>')
  }
  return sections.join('')
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
