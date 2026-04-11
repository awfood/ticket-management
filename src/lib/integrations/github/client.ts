// ============================================================
// GitHub REST API Client (v3)
// ============================================================

export interface GitHubRepo {
  id: number
  name: string
  fullName: string
  description: string | null
  private: boolean
  defaultBranch: string
  url: string
  openIssuesCount: number
  language: string | null
  updatedAt: string
}

export interface GitHubIssue {
  id: number
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed'
  labels: string[]
  assignee: string | null
  milestone: string | null
  createdAt: string
  updatedAt: string
  closedAt: string | null
  url: string
  author: string
}

export interface GitHubPR {
  id: number
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed' | 'merged'
  head: string
  base: string
  author: string
  labels: string[]
  draft: boolean
  merged: boolean
  mergedAt: string | null
  createdAt: string
  updatedAt: string
  closedAt: string | null
  url: string
  additions: number
  deletions: number
  changedFiles: number
}

interface GitHubClientConfig {
  accessToken: string
  owner: string
}

const GITHUB_API_BASE = 'https://api.github.com'

export class GitHubClient {
  private owner: string
  private headers: Record<string, string>

  constructor(config: GitHubClientConfig) {
    this.owner = config.owner
    this.headers = {
      Authorization: `Bearer ${config.accessToken}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    }
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${GITHUB_API_BASE}${path}`

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
        errorMessage = errorBody.message || `HTTP ${response.status}`
      } catch {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`
      }
      throw new Error(`GitHub API error: ${errorMessage}`)
    }

    return response.json() as Promise<T>
  }

  /**
   * Tests the connection and returns the authenticated user.
   */
  async testConnection(): Promise<{
    ok: boolean
    user?: string
    error?: string
  }> {
    try {
      const data = await this.request<{ login: string }>('/user')
      return { ok: true, user: data.login }
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error ? error.message : 'Unknown connection error',
      }
    }
  }

  /**
   * Fetches repositories for the configured owner.
   */
  async getRepos(): Promise<GitHubRepo[]> {
    const data = await this.request<
      Array<{
        id: number
        name: string
        full_name: string
        description: string | null
        private: boolean
        default_branch: string
        html_url: string
        open_issues_count: number
        language: string | null
        updated_at: string
      }>
    >(`/users/${this.owner}/repos?per_page=100&sort=updated`)

    return data.map((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      private: repo.private,
      defaultBranch: repo.default_branch,
      url: repo.html_url,
      openIssuesCount: repo.open_issues_count,
      language: repo.language,
      updatedAt: repo.updated_at,
    }))
  }

  /**
   * Searches issues within a repository.
   */
  async searchIssues(repo: string, query: string): Promise<GitHubIssue[]> {
    const q = encodeURIComponent(
      `${query} repo:${this.owner}/${repo} is:issue`
    )

    const data = await this.request<{
      items: Array<{
        id: number
        number: number
        title: string
        body: string | null
        state: 'open' | 'closed'
        labels: Array<{ name: string }>
        assignee: { login: string } | null
        milestone: { title: string } | null
        created_at: string
        updated_at: string
        closed_at: string | null
        html_url: string
        user: { login: string }
      }>
    }>(`/search/issues?q=${q}&per_page=30`)

    return data.items.map((issue) => this.mapIssue(issue))
  }

  /**
   * Fetches a single issue by number.
   */
  async getIssue(repo: string, issueNumber: number): Promise<GitHubIssue> {
    const data = await this.request<{
      id: number
      number: number
      title: string
      body: string | null
      state: 'open' | 'closed'
      labels: Array<{ name: string }>
      assignee: { login: string } | null
      milestone: { title: string } | null
      created_at: string
      updated_at: string
      closed_at: string | null
      html_url: string
      user: { login: string }
    }>(`/repos/${this.owner}/${repo}/issues/${issueNumber}`)

    return this.mapIssue(data)
  }

  /**
   * Creates a new issue in the specified repository.
   */
  async createIssue(
    repo: string,
    params: {
      title: string
      body: string
      labels?: string[]
    }
  ): Promise<GitHubIssue> {
    const data = await this.request<{
      id: number
      number: number
      title: string
      body: string | null
      state: 'open' | 'closed'
      labels: Array<{ name: string }>
      assignee: { login: string } | null
      milestone: { title: string } | null
      created_at: string
      updated_at: string
      closed_at: string | null
      html_url: string
      user: { login: string }
    }>(`/repos/${this.owner}/${repo}/issues`, {
      method: 'POST',
      body: JSON.stringify({
        title: params.title,
        body: params.body,
        labels: params.labels ?? [],
      }),
    })

    return this.mapIssue(data)
  }

  /**
   * Fetches a pull request by number.
   */
  async getPullRequest(repo: string, prNumber: number): Promise<GitHubPR> {
    const data = await this.request<{
      id: number
      number: number
      title: string
      body: string | null
      state: 'open' | 'closed'
      head: { ref: string }
      base: { ref: string }
      user: { login: string }
      labels: Array<{ name: string }>
      draft: boolean
      merged: boolean
      merged_at: string | null
      created_at: string
      updated_at: string
      closed_at: string | null
      html_url: string
      additions: number
      deletions: number
      changed_files: number
    }>(`/repos/${this.owner}/${repo}/pulls/${prNumber}`)

    return {
      id: data.id,
      number: data.number,
      title: data.title,
      body: data.body,
      state: data.merged ? 'merged' : data.state,
      head: data.head.ref,
      base: data.base.ref,
      author: data.user.login,
      labels: data.labels.map((l) => l.name),
      draft: data.draft,
      merged: data.merged,
      mergedAt: data.merged_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      closedAt: data.closed_at,
      url: data.html_url,
      additions: data.additions,
      deletions: data.deletions,
      changedFiles: data.changed_files,
    }
  }

  private mapIssue(raw: {
    id: number
    number: number
    title: string
    body: string | null
    state: 'open' | 'closed'
    labels: Array<{ name: string }>
    assignee: { login: string } | null
    milestone: { title: string } | null
    created_at: string
    updated_at: string
    closed_at: string | null
    html_url: string
    user: { login: string }
  }): GitHubIssue {
    return {
      id: raw.id,
      number: raw.number,
      title: raw.title,
      body: raw.body,
      state: raw.state,
      labels: raw.labels.map((l) => l.name),
      assignee: raw.assignee?.login ?? null,
      milestone: raw.milestone?.title ?? null,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
      closedAt: raw.closed_at,
      url: raw.html_url,
      author: raw.user.login,
    }
  }
}
