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

/** Full dashboard load: KPIs, actor/agent buckets, and session rows (e.g. `fetchDashboardInteractionSessionsPage`). */
export const DASHBOARD_INTERACTION_SESSIONS_QUERY = `
  query DashboardInteractionSessions(
    $repoId: String
    $filter: DashboardInteractionFilterInput
    $limit: Int
    $offset: Int
  ) {
    interactionKpis(repoId: $repoId, filter: $filter) {
      totalSessions
      totalTurns
      totalCheckpoints
      totalToolUses
    }
    interactionActors(repoId: $repoId, filter: $filter) {
      actorEmail
      sessionCount
      turnCount
    }
    interactionAgents(repoId: $repoId, filter: $filter) {
      key
      sessionCount
      turnCount
    }
    interactionSessions(repoId: $repoId, filter: $filter, limit: $limit, offset: $offset) {
      sessionId
      branch
      actor {
        name
        email
      }
      tokenUsage {
        inputTokens
        outputTokens
        cacheCreationTokens
        cacheReadTokens
        apiCallCount
      }
      agentType
      model
      firstPrompt
      startedAt
      lastEventAt
      turnCount
      checkpointCount
    }
  }
`

/** Sessions explorer default: `interactionSessions` only (same variables and session fields as above). */
export const DASHBOARD_INTERACTION_SESSIONS_ONLY_QUERY = `
  query DashboardInteractionSessionsOnly(
    $repoId: String
    $filter: DashboardInteractionFilterInput
    $limit: Int
    $offset: Int
  ) {
    interactionSessions(repoId: $repoId, filter: $filter, limit: $limit, offset: $offset) {
      sessionId
      branch
      actor {
        name
        email
      }
      tokenUsage {
        inputTokens
        outputTokens
        cacheCreationTokens
        cacheReadTokens
        apiCallCount
      }
      agentType
      model
      firstPrompt
      startedAt
      lastEventAt
      turnCount
      checkpointCount
    }
  }
`

export const DASHBOARD_INTERACTION_SESSION_DETAIL_QUERY = `
  query DashboardInteractionSessionDetail($repoId: String, $sessionId: String!) {
    interactionSession(repoId: $repoId, sessionId: $sessionId) {
      summary {
        sessionId
        branch
        actor {
          id
          name
          email
          source
        }
        agentType
        model
        firstPrompt
        startedAt
        endedAt
        lastEventAt
        turnCount
        checkpointCount
        tokenUsage {
          inputTokens
          outputTokens
          cacheCreationTokens
          cacheReadTokens
          apiCallCount
        }
        filePaths
        toolUses {
          toolUseId
          sessionId
          turnId
          toolKind
          taskDescription
          subagentId
          transcriptPath
          startedAt
          endedAt
        }
        linkedCheckpoints {
          checkpointId
          commitSha
          name
          email
          committedAt
        }
        latestCommitAuthor {
          checkpointId
          commitSha
          name
          email
          committedAt
        }
      }
      turns {
        turnId
        sessionId
        branch
        turnNumber
        prompt
        summary
        agentType
        model
        startedAt
        endedAt
        tokenUsage {
          inputTokens
          outputTokens
          cacheCreationTokens
          cacheReadTokens
          apiCallCount
        }
        filesModified
        checkpointId
        toolUses {
          toolUseId
          sessionId
          turnId
          toolKind
          taskDescription
          subagentId
          transcriptPath
          startedAt
          endedAt
        }
      }
      rawEvents {
        eventId
        sessionId
        turnId
        eventType
        eventTime
        agentType
        model
        toolUseId
        toolKind
        taskDescription
        subagentId
        payload
      }
    }
  }
`

export const DASHBOARD_INTERACTION_UPDATES_SUBSCRIPTION = `
  subscription DashboardInteractionUpdates($repoId: String) {
    interactionUpdates(repoId: $repoId) {
      repoId
      sessionCount
      turnCount
      latestSessionId
      latestSessionUpdatedAt
      latestTurnId
      latestTurnUpdatedAt
    }
  }
`
