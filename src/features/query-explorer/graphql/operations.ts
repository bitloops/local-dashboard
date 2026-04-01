export const QUERY_EXPLORER_DEFAULT_QUERY = `# Hold Ctrl/Cmd+Space to see autocomplete suggestions.
# Simplified dashboard commits query

query Commits(
  $repo: String!,
  $branch: String,
  $commitsFirst: Int
) {
  repo(name: $repo) {
    commits(branch: $branch, first: $commitsFirst) {
      edges {
        node {
          sha
          authorName
          commitMessage
          committedAt
        }
      }
    }
  }
}
`
