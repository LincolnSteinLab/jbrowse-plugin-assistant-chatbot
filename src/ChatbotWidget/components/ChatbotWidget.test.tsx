import '@testing-library/jest-dom'
import { render, fireEvent, screen } from '@testing-library/react'
import React from 'react'

import AssistantWidget from './ChatbotWidget'

it('renders and reacts to button push', async () => {
  render(<AssistantWidget />)

  expect(screen.getByRole('heading')).toHaveTextContent(
    'Hello plugin developers!',
  )

  fireEvent.click(screen.getByText('Push the button'))
  await screen.findByText('Whoa! You pushed the button!')
})
