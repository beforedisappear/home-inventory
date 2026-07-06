import type { EventListener } from './types';

type ListenerMap<E extends Record<string, unknown>> = {
  [K in keyof E]?: Set<EventListener<E[K]>>;
};

export class EventEmitter<Events extends Record<string, unknown>> {
  private listeners: ListenerMap<Events> = {};

  on<K extends keyof Events>(event: K, listener: EventListener<Events[K]>) {
    const eventListeners = this.listeners[event];

    if (!eventListeners) {
      this.listeners[event] = new Set([listener]);
    } else {
      eventListeners.add(listener);
    }
  }

  off<K extends keyof Events>(event: K, listener: EventListener<Events[K]>) {
    const eventListeners = this.listeners[event];

    if (!eventListeners) return;

    eventListeners.delete(listener);

    if (eventListeners.size === 0) {
      delete this.listeners[event];
    }
  }

  emit<K extends keyof Events>(event: K, data: Events[K]) {
    const eventListeners = this.listeners[event];

    if (!eventListeners) return;

    eventListeners.forEach(listener => listener(data));
  }
}
