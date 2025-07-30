CREATE TABLE `idempotency_keys` (
	`idempotency_key` text NOT NULL,
	`user_id` text NOT NULL,
	`message_ids` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`idempotency_key`, `user_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_idempotency_expires` ON `idempotency_keys` (`expires_at`);--> statement-breakpoint
CREATE TABLE `notification_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`message_id` text NOT NULL,
	`user_id` text NOT NULL,
	`channel_type` text NOT NULL,
	`template_key` text,
	`subject` text,
	`content` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`sent_at` text,
	`error` text,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`request_id` text,
	`variables` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_logs_message_id_unique` ON `notification_logs` (`message_id`);--> statement-breakpoint
CREATE INDEX `idx_notification_user` ON `notification_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_notification_status` ON `notification_logs` (`status`);--> statement-breakpoint
CREATE INDEX `idx_notification_created` ON `notification_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_notification_request_id` ON `notification_logs` (`request_id`);--> statement-breakpoint
CREATE TABLE `notification_templates_v2` (
	`template_key` text PRIMARY KEY NOT NULL,
	`template_name` text NOT NULL,
	`description` text,
	`variables` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_template_name_v2` ON `notification_templates_v2` (`template_name`);--> statement-breakpoint
CREATE TABLE `system_configs` (
	`config_key` text PRIMARY KEY NOT NULL,
	`config_value` text NOT NULL,
	`description` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `task_execution_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_name` text NOT NULL,
	`execution_time` text NOT NULL,
	`status` text DEFAULT 'completed' NOT NULL,
	`error` text,
	`duration_ms` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_task_name` ON `task_execution_records` (`task_name`);--> statement-breakpoint
CREATE INDEX `idx_execution_time` ON `task_execution_records` (`execution_time`);--> statement-breakpoint
CREATE TABLE `template_contents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`template_key` text NOT NULL,
	`channel_type` text NOT NULL,
	`content_type` text DEFAULT 'text' NOT NULL,
	`subject_template` text,
	`content_template` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`template_key`) REFERENCES `notification_templates_v2`(`template_key`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_template_channel_content` ON `template_contents` (`template_key`,`channel_type`);--> statement-breakpoint
CREATE UNIQUE INDEX `template_channel_unique` ON `template_contents` (`template_key`,`channel_type`);--> statement-breakpoint
CREATE TABLE `user_configs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`channel_type` text NOT NULL,
	`config_data` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_user_channel` ON `user_configs` (`user_id`,`channel_type`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_channel_unique` ON `user_configs` (`user_id`,`channel_type`);