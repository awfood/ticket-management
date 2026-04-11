// ============================================================
// Jira REST API Client
// ============================================================

import { adfToHtml, adfToText } from './adf-to-html'

export interface JiraProject {
  id: string
  key: string
  name: string
  projectTypeKey: string
  avatarUrl: string | null
}

export interface JiraIssue {
  id: string
  key: string
  summary: string
  description: string | null
  descriptionHtml: string | null
  status: string
  priority: string | null
  issueType: string
  assignee: string | null
  reporter: string | null
  created: string
  updated: string
  url: string
}

interface JiraClientConfig {
  baseUrl: string
  email: string
  apiToken: string
}

export class JiraClient {
  private baseUrl: string
  private headers: Record<string, string>

  constructor(config: JiraClientConfig) {
    // Remove trailing slash from base URL
    this.baseUrl = config.baseUrl.replace(/\/+$/, '')

    const credentials = Buffer.from(
      `${config.email}:${config.apiToken}`
    ).toString('base64')

    this.headers = {
      Authorization: `Basic ${credentials}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/rest/api/3${path}`

    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers,
      },
    })

    if (!response.ok) {
      let errorMessage: string
      try {
        const errorBody = await response.json()
        errorMessage =
          errorBody.errorMessages?.join(', ') ||
          errorBody.message ||
          `HTTP ${response.status}`
      } catch {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`
      }
      throw new Error(`Jira API error: ${errorMessage}`)
    }

    return response.json() as Promise<T>
  }

  /**
   * Tests the connection to Jira and returns the authenticated user.
   */
  async testConnection(): Promise<{
    ok: boolean
    user?: string
    error?: string
  }> {
    try {
      const data = await this.request<{ displayName: string }>('/myself')
      return { ok: true, user: data.displayName }
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error ? error.message : 'Unknown connection error',
      }
    }
  }

  /**
   * Fetches all accessible projects.
   */
  async getProjects(): Promise<JiraProject[]> {
    const data = await this.request<
      Array<{
        id: string
        key: string
        name: string
        projectTypeKey: string
        avatarUrls?: Record<string, string>
      }>
    >('/project?expand=description')

    return data.map((project) => ({
      id: project.id,
      key: project.key,
      name: project.name,
      projectTypeKey: project.projectTypeKey,
      avatarUrl: project.avatarUrls?.['48x48'] ?? null,
    }))
  }

  /**
   * Searches issues using JQL.
   * Uses POST /search/jql (new API, replaces deprecated GET /search).
   */
  async searchIssues(jql: string, maxResults = 50): Promise<JiraIssue[]> {
    const data = await this.request<{
      issues: Array<{
        id: string
        key: string
        self: string
        fields: {
          summary: string
          description: unknown
          status: { name: string }
          priority: { name: string } | null
          issuetype: { name: string }
          assignee: { displayName: string } | null
          reporter: { displayName: string } | null
          created: string
          updated: string
        }
      }>
    }>('/search/jql', {
      method: 'POST',
      body: JSON.stringify({
        jql,
        maxResults,
        fields: [
          'summary', 'description', 'status', 'priority',
          'issuetype', 'assignee', 'reporter', 'created', 'updated',
        ],
      }),
    })

    return data.issues.map((issue) => this.mapIssue(issue))
  }

  /**
   * Fetches a single issue by key (e.g., "PROJ-123").
   */
  async getIssue(issueKey: string): Promise<JiraIssue> {
    const data = await this.request<{
      id: string
      key: string
      self: string
      fields: {
        summary: string
        description: unknown
        status: { name: string }
        priority: { name: string } | null
        issuetype: { name: string }
        assignee: { displayName: string } | null
        reporter: { displayName: string } | null
        created: string
        updated: string
      }
    }>(
      `/issue/${issueKey}?fields=summary,description,status,priority,issuetype,assignee,reporter,created,updated`
    )

    return this.mapIssue(data)
  }

  /**
   * Creates a new issue in the specified project.
   */
  async createIssue(params: {
    projectKey: string
    summary: string
    description: string
    issueType?: string
    priority?: string
  }): Promise<JiraIssue> {
    const body: Record<string, unknown> = {
      fields: {
        project: { key: params.projectKey },
        summary: params.summary,
        description: this.toADF(params.description),
        issuetype: { name: params.issueType ?? 'Task' },
        ...(params.priority ? { priority: { name: params.priority } } : {}),
      },
    }

    const data = await this.request<{ id: string; key: string }>('/issue', {
      method: 'POST',
      body: JSON.stringify(body),
    })

    // Fetch the full issue after creation
    return this.getIssue(data.key)
  }

  /**
   * Returns the available statuses for a project.
   */
  async getIssueStatuses(
    projectKey: string
  ): Promise<{ id: string; name: string }[]> {
    const data = await this.request<
      Array<{
        statuses: Array<{ id: string; name: string }>
      }>
    >(`/project/${projectKey}/statuses`)

    // Flatten and deduplicate statuses from all issue types
    const seen = new Set<string>()
    const statuses: { id: string; name: string }[] = []

    for (const issueType of data) {
      for (const status of issueType.statuses) {
        if (!seen.has(status.id)) {
          seen.add(status.id)
          statuses.push({ id: status.id, name: status.name })
        }
      }
    }

    return statuses
  }

  /**
   * Converts plain text to Atlassian Document Format (ADF).
   */
  private toADF(text: string): Record<string, unknown> {
    return {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text }],
        },
      ],
    }
  }

  /**
   * Extracts plain text from an ADF document.
   */
  private extractDescription(description: unknown): string | null {
    if (!description) return null
    return adfToText(description)
  }

  /**
   * Converts an ADF document to HTML.
   */
  private extractDescriptionHtml(description: unknown): string | null {
    if (!description) return null
    return adfToHtml(description)
  }

  /**
   * Maps raw Jira API response to JiraIssue.
   */
  private mapIssue(raw: {
    id: string
    key: string
    self?: string
    fields: {
      summary: string
      description: unknown
      status: { name: string }
      priority: { name: string } | null
      issuetype: { name: string }
      assignee: { displayName: string } | null
      reporter: { displayName: string } | null
      created: string
      updated: string
    }
  }): JiraIssue {
    return {
      id: raw.id,
      key: raw.key,
      summary: raw.fields.summary,
      description: this.extractDescription(raw.fields.description),
      descriptionHtml: this.extractDescriptionHtml(raw.fields.description),
      status: raw.fields.status.name,
      priority: raw.fields.priority?.name ?? null,
      issueType: raw.fields.issuetype.name,
      assignee: raw.fields.assignee?.displayName ?? null,
      reporter: raw.fields.reporter?.displayName ?? null,
      created: raw.fields.created,
      updated: raw.fields.updated,
      url: `${this.baseUrl}/browse/${raw.key}`,
    }
  }
}
