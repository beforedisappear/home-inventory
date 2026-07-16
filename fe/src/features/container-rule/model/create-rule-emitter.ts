import { EventEmitter } from '@/shared/lib/event-emitter';

type CreateRuleEvents = {
  open: undefined;
};

export const createRuleEmitter = new EventEmitter<CreateRuleEvents>();
