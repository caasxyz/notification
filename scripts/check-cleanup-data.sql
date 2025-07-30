-- 查询待清理的通知日志（7天前的记录）
-- 注意：D1 数据库使用 TEXT 类型存储时间戳

-- 设置 7 天前的日期（需要手动计算并替换）
-- 例如：如果今天是 2025-01-06，那么 7 天前是 2024-12-30
-- 格式：YYYY-MM-DDTHH:MM:SS.sssZ

-- 1. 查询所有状态的统计
SELECT 
    status,
    COUNT(*) as count,
    MIN(created_at) as oldest_record,
    MAX(created_at) as newest_record
FROM notification_logs
GROUP BY status
ORDER BY count DESC;

-- 2. 查询 7 天前的待清理记录（只清理 'sent' 和 'failed' 状态）
-- 请将下面的日期替换为实际的 7 天前日期
SELECT 
    COUNT(*) as total_to_cleanup,
    status,
    MIN(created_at) as oldest_record,
    MAX(created_at) as newest_record
FROM notification_logs
WHERE 
    created_at <= '2024-12-30T00:00:00.000Z'  -- 替换为 7 天前的日期
    AND status IN ('sent', 'failed')
GROUP BY status;

-- 3. 查询所有 7 天前的记录（包括所有状态）
SELECT 
    COUNT(*) as total_old_records,
    status
FROM notification_logs
WHERE 
    created_at <= '2024-12-30T00:00:00.000Z'  -- 替换为 7 天前的日期
GROUP BY status
ORDER BY total_old_records DESC;

-- 4. 查看最近的日志记录时间分布
SELECT 
    DATE(created_at) as log_date,
    COUNT(*) as count,
    status
FROM notification_logs
GROUP BY DATE(created_at), status
ORDER BY log_date DESC
LIMIT 20;

-- 5. 查询所有 pending 状态的旧记录（这些不会被清理）
SELECT 
    COUNT(*) as pending_count,
    MIN(created_at) as oldest_pending,
    MAX(created_at) as newest_pending
FROM notification_logs
WHERE status = 'pending';

-- 6. 查询所有 retry 相关状态的记录
SELECT 
    COUNT(*) as retry_count,
    status,
    MIN(created_at) as oldest,
    MAX(created_at) as newest
FROM notification_logs
WHERE status IN ('retry', 'retry_scheduled')
GROUP BY status;

-- 7. 查看具体的旧记录样本
SELECT 
    id,
    message_id,
    user_id,
    status,
    created_at,
    retry_count
FROM notification_logs
WHERE created_at <= '2024-12-30T00:00:00.000Z'  -- 替换为 7 天前的日期
ORDER BY created_at ASC
LIMIT 10;