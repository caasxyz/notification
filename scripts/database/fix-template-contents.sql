-- 修复 template_contents 表结构不一致问题
-- 此脚本会检查并处理 is_active 字段

-- 方案1：如果表中有 is_active 字段但代码不使用，删除该字段
-- 注意：SQLite 不支持 ALTER TABLE DROP COLUMN，需要重建表

-- 备份现有数据
CREATE TABLE IF NOT EXISTS template_contents_backup AS 
SELECT id, template_key, channel_type, content_type, subject_template, 
       content_template, created_at, updated_at 
FROM template_contents;

-- 删除原表
DROP TABLE IF EXISTS template_contents;

-- 重新创建表（不包含 is_active）
CREATE TABLE template_contents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_key TEXT NOT NULL,
  channel_type TEXT NOT NULL,
  content_type TEXT NOT NULL,
  subject_template TEXT,
  content_template TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (template_key) REFERENCES notification_templates_v2(template_key) ON DELETE CASCADE,
  UNIQUE(template_key, channel_type)
);

-- 创建索引
CREATE INDEX idx_template_channel_content ON template_contents(template_key, channel_type);

-- 恢复数据
INSERT INTO template_contents 
SELECT id, template_key, channel_type, content_type, subject_template, 
       content_template, created_at, updated_at 
FROM template_contents_backup;

-- 删除备份表
DROP TABLE template_contents_backup;