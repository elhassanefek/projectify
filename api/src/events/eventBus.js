class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50); // Prevent memory leaks
  }

  emitEvent(event, payload) {
    // Validate event name
    if (!event || typeof event !== 'string') {
      throw new Error('Event name must be a non-empty string');
    }

    try {
      logger.debug(`📡 Event emitted → ${event}`);
      this.emit(event, payload);
    } catch (error) {
      logger.error(`Failed to emit event ${event}:`, error);
      // Don't throw - prevent cascade failures
    }
  }

  subscribe(event, handler) {
    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }

    // Wrap handler with error boundary
    const wrappedHandler = async (payload) => {
      try {
        await handler(payload);
      } catch (error) {
        logger.error(`Error in ${event} handler:`, error);
        // Optionally emit error event
        this.emit('handler:error', { event, error, payload });
      }
    };

    logger.debug(`🔔 Subscribed to ${event}`);
    this.on(event, wrappedHandler);

    return () => this.off(event, wrappedHandler); // Return unsubscribe function
  }
}

module.exports = new EventBus();
