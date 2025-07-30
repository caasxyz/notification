// Main clients
export { NotificationClient } from './client';
export { EnhancedNotificationClient } from './enhanced-client';

// Builders and helpers
export { NotificationBuilder, QuickNotification } from './builder';
export { NotificationPresets } from './presets';
export { SmartChannelSelector } from './smart-channel';

// Types
export * from './types';

// Utilities
export { createHmacSignature, verifyHmacSignature } from './utils/signature';
export { TemplateRenderer } from './utils/template';