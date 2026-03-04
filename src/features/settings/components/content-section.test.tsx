import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ContentSection } from './content-section'

describe('ContentSection', () => {
  it('renders title and description', () => {
    render(
      <ContentSection title='Appearance' desc='Customize theme and display.'>
        <div>Form content</div>
      </ContentSection>
    )
    expect(screen.getByRole('heading', { name: 'Appearance' })).toBeInTheDocument()
    expect(screen.getByText('Customize theme and display.')).toBeInTheDocument()
  })

  it('renders children', () => {
    render(
      <ContentSection title='Section' desc='Description'>
        <div>Form content</div>
      </ContentSection>
    )
    expect(screen.getByText('Form content')).toBeInTheDocument()
  })
})
