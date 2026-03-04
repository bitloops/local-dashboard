import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { NavigationProgress } from './navigation-progress'

describe('NavigationProgress', () => {
  it('renders nothing', () => {
    const { container } = render(<NavigationProgress />)
    expect(container.firstChild).toBeNull()
  })
})
