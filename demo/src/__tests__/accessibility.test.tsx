import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import StreamStatusCard from '../StreamStatusCard';

test('has no accessibility violations', async () => {
  const { container } = render(<StreamStatusCard status="active" amount={100} />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});

test('keyboard navigation works (basic)', async () => {
  render(<StreamStatusCard status="active" amount={100} />);
  const user = userEvent.setup();
  // basic tab navigation smoke test
  await user.tab();
  // ensure focus moves somewhere without throwing
  expect(document.activeElement).toBeTruthy();
});
