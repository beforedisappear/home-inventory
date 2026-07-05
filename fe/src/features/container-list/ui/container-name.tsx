import { useState } from 'react';

import { Tooltip, Typography } from '@/shared/ui';

interface Props {
  name: string;
}

export function ContainerName({ name }: Props) {
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);

  return (
    <Tooltip
      isOpen={isTooltipOpen}
      onOpenChange={setIsTooltipOpen}
      shouldCloseOnPress={false}
    >
      <Tooltip.Trigger
        className='min-w-0 flex-1'
        onClick={() => setIsTooltipOpen(v => !v)}
      >
        <Typography.Heading level={3} truncate>
          {name}
        </Typography.Heading>
      </Tooltip.Trigger>

      <Tooltip.Content>{name}</Tooltip.Content>
    </Tooltip>
  );
}
