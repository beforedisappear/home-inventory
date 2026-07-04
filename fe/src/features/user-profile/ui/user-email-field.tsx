import { Input, Label, TextField } from '@/shared/ui';

import { UserEmailChange } from './user-email-change';

interface Props {
  email: string;
}

export function UserEmailField(props: Props) {
  return (
    <TextField
      value={props.email}
      onChange={() => {}}
      className='flex flex-col gap-1'
    >
      <div className='flex items-center justify-between gap-3'>
        <Label>Email</Label>
        <UserEmailChange />
      </div>

      <Input disabled />
    </TextField>
  );
}
