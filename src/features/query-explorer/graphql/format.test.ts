import { describe, expect, it } from 'vitest'
import { formatGraphqlDocument } from './format'

describe('formatGraphqlDocument', () => {
  it('formats valid GraphQL documents', async () => {
    await expect(
      formatGraphqlDocument(
        'query Test{repo(name:""){commits(first:1){edges{node{sha}}}}}',
      ),
    ).resolves.toBe(
      `query Test {
  repo(name: "") {
    commits(first: 1) {
      edges {
        node {
          sha
        }
      }
    }
  }
}
`,
    )
  })

  it('rejects invalid GraphQL documents', async () => {
    await expect(formatGraphqlDocument('query {')).rejects.toThrow()
  })
})
