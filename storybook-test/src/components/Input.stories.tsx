import type { Meta, StoryObj } from '@storybook/react';
import { Input } from './Input';

const meta: Meta<typeof Input> = {
  component: Input,
  title: 'Components/Input',
};
export default meta;

type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: { placeholder: 'Enter text...' },
};

export const WithValue: Story = {
  args: { value: 'Hello', placeholder: 'Enter text...' },
};

export const Error: Story = {
  args: { placeholder: 'Invalid input', error: true },
};

export const Disabled: Story = {
  args: { placeholder: 'Disabled', disabled: true },
};
