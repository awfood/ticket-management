// ============================================================
// Atlassian Document Format (ADF) → HTML Converter
// Handles all common ADF node types from Jira
// ============================================================

interface AdfNode {
  type: string
  text?: string
  content?: AdfNode[]
  attrs?: Record<string, unknown>
  marks?: AdfMark[]
}

interface AdfMark {
  type: string
  attrs?: Record<string, unknown>
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderMarks(text: string, marks?: AdfMark[]): string {
  if (!marks || marks.length === 0) return escapeHtml(text)

  let result = escapeHtml(text)

  for (const mark of marks) {
    switch (mark.type) {
      case 'strong':
        result = `<strong>${result}</strong>`
        break
      case 'em':
        result = `<em>${result}</em>`
        break
      case 'underline':
        result = `<u>${result}</u>`
        break
      case 'strike':
        result = `<s>${result}</s>`
        break
      case 'code':
        result = `<code>${result}</code>`
        break
      case 'link': {
        const href = mark.attrs?.href as string
        if (href) {
          result = `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${result}</a>`
        }
        break
      }
      case 'textColor': {
        const color = mark.attrs?.color as string
        if (color) {
          result = `<span style="color:${escapeHtml(color)}">${result}</span>`
        }
        break
      }
      case 'subsup': {
        const subType = mark.attrs?.type as string
        if (subType === 'sub') result = `<sub>${result}</sub>`
        else if (subType === 'sup') result = `<sup>${result}</sup>`
        break
      }
    }
  }

  return result
}

function renderNode(node: AdfNode): string {
  switch (node.type) {
    case 'doc':
      return (node.content ?? []).map(renderNode).join('')

    case 'paragraph':
      return `<p>${renderChildren(node)}</p>`

    case 'heading': {
      const level = Math.min(6, Math.max(1, (node.attrs?.level as number) ?? 1))
      return `<h${level}>${renderChildren(node)}</h${level}>`
    }

    case 'text':
      return renderMarks(node.text ?? '', node.marks)

    case 'hardBreak':
      return '<br>'

    case 'rule':
    case 'horizontalRule':
      return '<hr>'

    case 'bulletList':
      return `<ul>${renderChildren(node)}</ul>`

    case 'orderedList': {
      const start = (node.attrs?.order as number) ?? 1
      return start === 1
        ? `<ol>${renderChildren(node)}</ol>`
        : `<ol start="${start}">${renderChildren(node)}</ol>`
    }

    case 'listItem':
      return `<li>${renderChildren(node)}</li>`

    case 'blockquote':
      return `<blockquote>${renderChildren(node)}</blockquote>`

    case 'codeBlock': {
      const lang = (node.attrs?.language as string) ?? ''
      const code = (node.content ?? [])
        .map((child) => escapeHtml(child.text ?? ''))
        .join('\n')
      return lang
        ? `<pre><code class="language-${escapeHtml(lang)}">${code}</code></pre>`
        : `<pre><code>${code}</code></pre>`
    }

    case 'table':
      return `<table>${renderChildren(node)}</table>`

    case 'tableRow':
      return `<tr>${renderChildren(node)}</tr>`

    case 'tableHeader': {
      const colspan = (node.attrs?.colspan as number) ?? 1
      const rowspan = (node.attrs?.rowspan as number) ?? 1
      const attrs = []
      if (colspan > 1) attrs.push(`colspan="${colspan}"`)
      if (rowspan > 1) attrs.push(`rowspan="${rowspan}"`)
      return `<th${attrs.length ? ' ' + attrs.join(' ') : ''}>${renderChildren(node)}</th>`
    }

    case 'tableCell': {
      const colspan = (node.attrs?.colspan as number) ?? 1
      const rowspan = (node.attrs?.rowspan as number) ?? 1
      const attrs = []
      if (colspan > 1) attrs.push(`colspan="${colspan}"`)
      if (rowspan > 1) attrs.push(`rowspan="${rowspan}"`)
      return `<td${attrs.length ? ' ' + attrs.join(' ') : ''}>${renderChildren(node)}</td>`
    }

    case 'panel': {
      const panelType = (node.attrs?.panelType as string) ?? 'info'
      return `<div class="panel panel-${escapeHtml(panelType)}">${renderChildren(node)}</div>`
    }

    case 'expand': {
      const title = (node.attrs?.title as string) ?? ''
      return `<details><summary>${escapeHtml(title)}</summary>${renderChildren(node)}</details>`
    }

    case 'emoji': {
      const shortName = (node.attrs?.shortName as string) ?? ''
      const text = (node.attrs?.text as string) ?? shortName
      return text || shortName
    }

    case 'mention': {
      const mentionText = (node.attrs?.text as string) ?? ''
      return `<strong>${escapeHtml(mentionText)}</strong>`
    }

    case 'inlineCard':
    case 'blockCard': {
      const url = (node.attrs?.url as string) ?? ''
      return url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>` : ''
    }

    case 'mediaSingle':
    case 'media':
      // Media nodes reference external files — we can't resolve them
      return '<p><em>[Anexo do Jira]</em></p>'

    case 'status': {
      const statusText = (node.attrs?.text as string) ?? ''
      return `<span class="status">${escapeHtml(statusText)}</span>`
    }

    case 'date': {
      const timestamp = (node.attrs?.timestamp as string) ?? ''
      if (timestamp) {
        const date = new Date(parseInt(timestamp))
        return `<time datetime="${date.toISOString()}">${date.toLocaleDateString('pt-BR')}</time>`
      }
      return ''
    }

    case 'taskList':
      return `<ul class="task-list">${renderChildren(node)}</ul>`

    case 'taskItem': {
      const checked = (node.attrs?.state as string) === 'DONE'
      return `<li class="task-item"><input type="checkbox" disabled ${checked ? 'checked' : ''}> ${renderChildren(node)}</li>`
    }

    case 'decisionList':
      return `<ul class="decision-list">${renderChildren(node)}</ul>`

    case 'decisionItem':
      return `<li class="decision-item">${renderChildren(node)}</li>`

    default:
      // Unknown node: try to render children, fallback to text
      if (node.content) return renderChildren(node)
      if (node.text) return renderMarks(node.text, node.marks)
      return ''
  }
}

function renderChildren(node: AdfNode): string {
  return (node.content ?? []).map(renderNode).join('')
}

// ============================================================
// Public API
// ============================================================

/**
 * Converts an ADF document to HTML.
 */
export function adfToHtml(adf: unknown): string {
  if (!adf) return ''
  if (typeof adf === 'string') return `<p>${escapeHtml(adf)}</p>`

  try {
    return renderNode(adf as AdfNode)
  } catch {
    return `<p>${escapeHtml(JSON.stringify(adf))}</p>`
  }
}

/**
 * Converts an ADF document to plain text (for search and summary).
 */
export function adfToText(adf: unknown): string {
  if (!adf) return ''
  if (typeof adf === 'string') return adf

  try {
    return extractText(adf as AdfNode).trim()
  } catch {
    return JSON.stringify(adf)
  }
}

function extractText(node: AdfNode): string {
  if (node.text) return node.text

  const parts: string[] = []
  for (const child of node.content ?? []) {
    const text = extractText(child)
    if (text) parts.push(text)
  }

  // Add newlines for block elements
  const blockTypes = [
    'paragraph', 'heading', 'bulletList', 'orderedList',
    'listItem', 'codeBlock', 'blockquote', 'tableRow',
    'rule', 'horizontalRule',
  ]

  if (blockTypes.includes(node.type)) {
    return parts.join('') + '\n'
  }

  return parts.join('')
}
