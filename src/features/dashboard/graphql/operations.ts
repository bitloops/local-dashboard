export const DASHBOARD_REPOSITORIES_QUERY = `
  query DashboardRepositories {
    repositories {
      repoId
      identity
      name
      provider
      organization
      defaultBranch
    }
  }
`

export const DASHBOARD_BRANCHES_QUERY = `
  query DashboardBranches($repoId: String, $from: String, $to: String) {
    branches(repoId: $repoId, from: $from, to: $to) {
      branch
      checkpointCommits
    }
  }
`

export const DASHBOARD_USERS_QUERY = `
  query DashboardUsers(
    $repoId: String
    $branch: String!
    $from: String
    $to: String
    $agent: String
  ) {
    users(repoId: $repoId, branch: $branch, from: $from, to: $to, agent: $agent) {
      key
      name
      email
    }
  }
`

export const DASHBOARD_AGENTS_QUERY = `
  query DashboardAgents(
    $repoId: String
    $branch: String!
    $from: String
    $to: String
    $user: String
  ) {
    agents(repoId: $repoId, branch: $branch, from: $from, to: $to, user: $user) {
      key
    }
  }
`

export const DASHBOARD_COMMITS_QUERY = `
  query DashboardCommits(
    $repoId: String
    $branch: String!
    $from: String
    $to: String
    $user: String
    $agent: String
    $limit: Int
    $offset: Int
  ) {
    commits(
      repoId: $repoId
      branch: $branch
      from: $from
      to: $to
      user: $user
      agent: $agent
      limit: $limit
      offset: $offset
    ) {
      commit {
        sha
        parents
        authorName
        authorEmail
        timestamp
        message
        filesTouched {
          filepath
          additionsCount
          deletionsCount
          changeKind
          copiedFromPath
          copiedFromBlobSha
        }
      }
      checkpoint {
        checkpointId
        strategy
        branch
        checkpointsCount
        filesTouched {
          filepath
          additionsCount
          deletionsCount
          changeKind
          copiedFromPath
          copiedFromBlobSha
        }
        sessionCount
        tokenUsage {
          inputTokens
          outputTokens
          cacheCreationTokens
          cacheReadTokens
          apiCallCount
        }
        sessionId
        agents
        firstPromptPreview
        createdAt
        isTask
        toolUseId
      }
      checkpoints {
        checkpointId
        strategy
        branch
        checkpointsCount
        filesTouched {
          filepath
          additionsCount
          deletionsCount
          changeKind
          copiedFromPath
          copiedFromBlobSha
        }
        sessionCount
        tokenUsage {
          inputTokens
          outputTokens
          cacheCreationTokens
          cacheReadTokens
          apiCallCount
        }
        sessionId
        agents
        firstPromptPreview
        createdAt
        isTask
        toolUseId
      }
    }
  }
`

export const DASHBOARD_CHECKPOINT_DETAIL_QUERY = `
  query DashboardCheckpointDetail($repoId: String, $checkpointId: String!) {
    checkpoint(repoId: $repoId, checkpointId: $checkpointId) {
      checkpointId
      strategy
      branch
      checkpointsCount
      filesTouched {
        filepath
        additionsCount
        deletionsCount
        changeKind
        copiedFromPath
        copiedFromBlobSha
      }
      sessionCount
      tokenUsage {
        inputTokens
        outputTokens
        cacheCreationTokens
        cacheReadTokens
        apiCallCount
      }
      sessions {
        sessionIndex
        sessionId
        agent
        createdAt
        isTask
        toolUseId
        metadataJson
        transcriptJsonl
        promptsText
        contextText
      }
    }
  }
`
