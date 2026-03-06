import type { Meta, StoryObj } from '@storybook/react';
import { Card } from './Card';
import { Button } from './Button';

const meta: Meta<typeof Card> = {
  component: Card,
  title: 'Components/Card',
};
export default meta;

type Story = StoryObj<typeof Card>;

export const Default: Story = {
  args: {
    title: 'Card Title',
    description: 'A simple card component with title and description.',
  },
};

export const WithAction: Story = {
  args: {
    title: 'Card with Button',
    description: 'Card containing a call-to-action.',
    children: <Button label="Action" variant="primary" />,
  },
};
