module.exports = function registerEventHandlers(eventBus, socketService) {
  if (!eventBus || !socketService) {
    throw new Error('EventBus and SocketService are required');
  }

  const handlers = [
    taskHandlers,
    // workspaceHandlers,
    // projectHandlers,
    // commentHandlers,
  ];

  handlers.forEach((registerHandler) => {
    try {
      registerHandler(eventBus, socketService);
      console.log(`✅ Registered ${registerHandler.name}`);
    } catch (error) {
      console.error(`❌ Failed to register ${registerHandler.name}:`, error);
      throw error; // Fail fast on startup
    }
  });
};
