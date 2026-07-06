import { useEffect } from 'react';

import { EventEmitter } from './event-emitter';

export function useEvent<
  Events extends Record<string, unknown>,
  K extends keyof Events,
>(
  eventEmitter: EventEmitter<Events>,
  event: K,
  callback: (data: Events[K]) => void,
) {
  useEffect(() => {
    eventEmitter.on(event, callback);

    return () => {
      eventEmitter.off(event, callback);
    };
  }, [event, callback, eventEmitter]);
}
