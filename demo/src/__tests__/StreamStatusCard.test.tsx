import React from 'react';
import { render } from '@testing-library/react';
import renderer from 'react-test-renderer';
import StreamStatusCard from '../StreamStatusCard';

test('StreamStatusCard snapshot', () => {
  const tree = renderer.create(<StreamStatusCard status="active" amount={100} />).toJSON();
  expect(tree).toMatchSnapshot();
});
