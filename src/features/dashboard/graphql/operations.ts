export const DASHBOARD_REPO_NAME = ''

export const DASHBOARD_BRANCHES_QUERY = `
  query DashboardBranches($repo: String!, $since: DateTime, $until: DateTime) {
    repo(name: $repo) {
      branches(since: $since, until: $until) {
        name
        checkpointCount
      }
    }
  }
`

/** Repo-wide user/agent key lists for filter dropdowns (not derived from commits). */
export const DASHBOARD_REPO_OPTIONS_QUERY = `
  query DashboardRepoOptions($repo: String!, $since: DateTime, $until: DateTime) {
    repo(name: $repo) {
      users
      agents
    }
  }
`

/**
 * Commits only — cursor pagination via `after` + `pageInfo`.
 * Pass `author` to narrow commits server-side when a user is selected; **agent** filtering stays client-side.
 */
export const DASHBOARD_COMMITS_QUERY = `
  query DashboardCommits(
    $repo: String!,
    $branch: String,
    $since: DateTime,
    $until: DateTime,
    $author: String,
    $after: String,
    $commitsFirst: Int!
  ) {
    repo(name: $repo) {
      commits(
        branch: $branch,
        since: $since,
        until: $until,
        author: $author,
        first: $commitsFirst,
        after: $after
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            sha
            parents
            authorName
            authorEmail
            commitMessage
            committedAt
            filesChanged
            checkpoints(first: 100) {
              edges {
                node {
                  id
                  branch
                  agent
                  strategy
                  filesTouched
                  checkpointsCount
                  sessionCount
                  sessionId
                  agents
                  firstPromptPreview
                  createdAt
                  isTask
                  toolUseId
                  tokenUsage {
                    inputTokens
                    outputTokens
                    cacheCreationTokens
                    cacheReadTokens
                    apiCallCount
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`
