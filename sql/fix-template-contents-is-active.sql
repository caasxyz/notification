-- 修复 template_contents 表缺少 is_active 字段的问题

-- 添加 is_active 字段到 template_contents 表
ALTER TABLE template_contents 
ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;

-- 验证字段是否添加成功
SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'template_contents';