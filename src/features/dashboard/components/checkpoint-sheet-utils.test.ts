import { describe, expect, it } from 'vitest'
import {
  formatPromptForDisplay,
  stripUserQueryTags,
} from './checkpoint-sheet-utils'

describe('stripUserQueryTags', () => {
  it('removes user_query tags and keeps inner spacing', () => {
    expect(stripUserQueryTags('<user_query>\nhello there\n</user_query>')).toBe(
      '\nhello there\n',
    )
  })
})

describe('formatPromptForDisplay', () => {
  it('strips user_query wrappers and trims outer whitespace', () => {
    expect(
      formatPromptForDisplay('  <user_query>\n  hello\n  </user_query>  '),
    ).toBe('hello')
  })

  it('returns empty string for null or blank', () => {
    expect(formatPromptForDisplay(null)).toBe('')
    expect(formatPromptForDisplay('   ')).toBe('')
  })
})
