-- Performance Optimization Indexes
-- Run this after the main schema.sql

-- Composite index for user notifications query
CREATE INDEX IF NOT EXISTS idx_notifications_user_status 
ON notification_logs(user_id, status, created_at DESC);

-- Index for timestamp-based queries
CREATE INDEX IF NOT EXISTS idx_notifications_created_at 
ON notification_logs(created_at DESC);

-- Index for request_id lookups (idempotency checks)
CREATE INDEX IF NOT EXISTS idx_notifications_request_id 
ON notification_logs(request_id)
WHERE request_id IS NOT NULL;

-- Partial index for pending/retrying notifications
CREATE INDEX IF NOT EXISTS idx_notifications_pending 
ON notification_logs(status, retry_count, next_retry_at)
WHERE status IN ('pending', 'retrying');

-- Index for user configs lookup
CREATE INDEX IF NOT EXISTS idx_user_configs_user_channel 
ON user_configs(user_id, channel_type, is_active);

-- Index for template lookups
CREATE INDEX IF NOT EXISTS idx_templates_key_active 
ON notification_templates_v2(template_key, is_active)
WHERE is_active = 1;

-- Index for template contents
CREATE INDEX IF NOT EXISTS idx_template_contents_template_channel 
ON template_contents(template_id, channel_type);

-- Index for cleanup operations
CREATE INDEX IF NOT EXISTS idx_notifications_cleanup 
ON notification_logs(created_at, status)
WHERE status IN ('completed', 'failed');