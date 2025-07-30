import { sqliteTable, text, integer, primaryKey, index, unique } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// User configurations table
export const userConfigs = sqliteTable('user_configs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: text('user_id').notNull(),
  channel_type: text('channel_type').notNull(),
  config_data: text('config_data').notNull(),
  is_active: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  userChannelIdx: index('idx_user_channel').on(table.user_id, table.channel_type),
  userChannelUnique: unique('user_channel_unique').on(table.user_id, table.channel_type),
}));

// Notification templates V2 table
export const notificationTemplatesV2 = sqliteTable('notification_templates_v2', {
  template_key: text('template_key').primaryKey(),
  template_name: text('template_name').notNull(),
  description: text('description'),
  variables: text('variables'), // JSON array
  is_active: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  templateNameIdx: index('idx_template_name_v2').on(table.template_name),
}));

// Template contents table
export const templateContents = sqliteTable('template_contents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  template_key: text('template_key').notNull().references(() => notificationTemplatesV2.template_key, { onDelete: 'cascade' }),
  channel_type: text('channel_type').notNull(),
  content_type: text('content_type').notNull().default('text'),
  subject_template: text('subject_template'),
  content_template: text('content_template').notNull(),
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  templateChannelIdx: index('idx_template_channel_content').on(table.template_key, table.channel_type),
  templateChannelUnique: unique('template_channel_unique').on(table.template_key, table.channel_type),
}));

// Notification logs table
export const notificationLogs = sqliteTable('notification_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  message_id: text('message_id').notNull().unique(),
  user_id: text('user_id').notNull(),
  channel_type: text('channel_type').notNull(),
  template_key: text('template_key'),
  subject: text('subject'),
  content: text('content'),
  status: text('status').notNull().default('pending'),
  sent_at: text('sent_at'),
  error: text('error'),
  retry_count: integer('retry_count').notNull().default(0),
  request_id: text('request_id'),
  variables: text('variables'), // JSON
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  userIdx: index('idx_notification_user').on(table.user_id),
  statusIdx: index('idx_notification_status').on(table.status),
  createdAtIdx: index('idx_notification_created').on(table.created_at),
  requestIdIdx: index('idx_notification_request_id').on(table.request_id),
}));

// System configurations table
export const systemConfigs = sqliteTable('system_configs', {
  config_key: text('config_key').primaryKey(),
  config_value: text('config_value').notNull(),
  description: text('description'),
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Idempotency keys table
export const idempotencyKeys = sqliteTable('idempotency_keys', {
  idempotency_key: text('idempotency_key').notNull(),
  user_id: text('user_id').notNull(),
  message_ids: text('message_ids').notNull(), // JSON array
  expires_at: text('expires_at').notNull(),
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  pk: primaryKey({ columns: [table.idempotency_key, table.user_id] }),
  expiresIdx: index('idx_idempotency_expires').on(table.expires_at),
}));

// Task execution records table
export const taskExecutionRecords = sqliteTable('task_execution_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  task_name: text('task_name').notNull(),
  execution_time: text('execution_time').notNull(),
  status: text('status').notNull().default('completed'),
  error: text('error'),
  duration_ms: integer('duration_ms'),
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  taskNameIdx: index('idx_task_name').on(table.task_name),
  executionTimeIdx: index('idx_execution_time').on(table.execution_time),
}));

// Types for TypeScript
export type UserConfig = typeof userConfigs.$inferSelect;
export type NewUserConfig = typeof userConfigs.$inferInsert;

export type NotificationTemplateV2 = typeof notificationTemplatesV2.$inferSelect;
export type NewNotificationTemplateV2 = typeof notificationTemplatesV2.$inferInsert;

export type TemplateContent = typeof templateContents.$inferSelect;
export type NewTemplateContent = typeof templateContents.$inferInsert;

export type NotificationLog = typeof notificationLogs.$inferSelect;
export type NewNotificationLog = typeof notificationLogs.$inferInsert;

export type SystemConfig = typeof systemConfigs.$inferSelect;
export type NewSystemConfig = typeof systemConfigs.$inferInsert;

export type IdempotencyKey = typeof idempotencyKeys.$inferSelect;
export type NewIdempotencyKey = typeof idempotencyKeys.$inferInsert;

export type TaskExecutionRecord = typeof taskExecutionRecords.$inferSelect;
export type NewTaskExecutionRecord = typeof taskExecutionRecords.$inferInsert;