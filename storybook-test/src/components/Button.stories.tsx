import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
  title: 'Components/Button',
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { label: 'Primary Button', variant: 'primary' },
};

export const Secondary: Story = {
  args: { label: 'Secondary', variant: 'secondary' },
};

export const Danger: Story = {
  args: { label: 'Danger', variant: 'danger' },
};

export const Disabled: Story = {
  args: { label: 'Disabled', disabled: true },
};
