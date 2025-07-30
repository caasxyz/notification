type EventListener<T = any> = (data: T) => void;

export class EventEmitter<Events extends Record<string, any>> {
  private listeners: Map<keyof Events, Set<EventListener>> = new Map();

  on<K extends keyof Events>(event: K, listener: EventListener<Events[K]>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  off<K extends keyof Events>(event: K, listener: EventListener<Events[K]>): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener);
      if (eventListeners.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  once<K extends keyof Events>(event: K, listener: EventListener<Events[K]>): void {
    const onceListener = (data: Events[K]) => {
      listener(data);
      this.off(event, onceListener);
    };
    this.on(event, onceListener);
  }

  emit<K extends keyof Events>(event: K, data: Events[K]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in event listener for ${String(event)}:`, error);
        }
      });
    }
  }

  removeAllListeners<K extends keyof Events>(event?: K): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  listenerCount<K extends keyof Events>(event: K): number {
    return this.listeners.get(event)?.size || 0;
  }

  getListeners<K extends keyof Events>(event: K): EventListener<Events[K]>[] {
    const eventListeners = this.listeners.get(event);
    return eventListeners ? Array.from(eventListeners) : [];
  }
}