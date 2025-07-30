-- Production Templates Initialization
-- These are essential templates for production use

-- System Alert Template
INSERT OR REPLACE INTO notification_templates_v2 (template_key, template_name, description, variables, is_active) 
VALUES (
    'system_alert',
    'System Alert',
    'Critical system alerts and notifications',
    '["alert_type","severity","message","timestamp","action_required"]',
    1
);

-- System Alert - Email
INSERT OR REPLACE INTO template_contents (template_key, channel_type, subject_template, content_template, content_type) 
VALUES (
    'system_alert',
    'email',
    '[{{severity}}] System Alert: {{alert_type}}',
    '<h2>System Alert</h2>
<p><strong>Type:</strong> {{alert_type}}</p>
<p><strong>Severity:</strong> {{severity}}</p>
<p><strong>Time:</strong> {{timestamp}}</p>
<hr>
<p><strong>Message:</strong></p>
<p>{{message}}</p>
<hr>
<p><strong>Action Required:</strong></p>
<p>{{action_required}}</p>',
    'html'
);

-- System Alert - Lark
INSERT OR REPLACE INTO template_contents (template_key, channel_type, content_template, content_type) 
VALUES (
    'system_alert',
    'lark',
    '**[{{severity}}] System Alert**

**Type:** {{alert_type}}
**Time:** {{timestamp}}

**Message:**
{{message}}

**Action Required:**
{{action_required}}',
    'markdown'
);

-- System Alert - Webhook
INSERT OR REPLACE INTO template_contents (template_key, channel_type, content_template, content_type) 
VALUES (
    'system_alert',
    'webhook',
    '{
  "alert_type": "{{alert_type}}",
  "severity": "{{severity}}",
  "message": "{{message}}",
  "timestamp": "{{timestamp}}",
  "action_required": "{{action_required}}"
}',
    'json'
);

-- User Notification Template
INSERT OR REPLACE INTO notification_templates_v2 (template_key, template_name, description, variables, is_active) 
VALUES (
    'user_notification',
    'User Notification',
    'General user notifications',
    '["title","message","action_text","action_url"]',
    1
);

-- User Notification - Email
INSERT OR REPLACE INTO template_contents (template_key, channel_type, subject_template, content_template, content_type) 
VALUES (
    'user_notification',
    'email',
    '{{title}}',
    '<div style="font-family: Arial, sans-serif;">
<h2>{{title}}</h2>
<p>{{message}}</p>
<p><a href="{{action_url}}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">{{action_text}}</a></p>
</div>',
    'html'
);

-- User Notification - Lark
INSERT OR REPLACE INTO template_contents (template_key, channel_type, content_template, content_type) 
VALUES (
    'user_notification',
    'lark',
    '**{{title}}**

{{message}}

[{{action_text}}]({{action_url}})',
    'markdown'
);

-- Status Update Template
INSERT OR REPLACE INTO notification_templates_v2 (template_key, template_name, description, variables, is_active) 
VALUES (
    'status_update',
    'Status Update',
    'Service status updates and maintenance notifications',
    '["service_name","status","description","affected_features","estimated_time"]',
    1
);

-- Status Update - Email
INSERT OR REPLACE INTO template_contents (template_key, channel_type, subject_template, content_template, content_type) 
VALUES (
    'status_update',
    'email',
    '{{service_name}} Status: {{status}}',
    '<h2>Service Status Update</h2>
<p><strong>Service:</strong> {{service_name}}</p>
<p><strong>Status:</strong> {{status}}</p>
<p><strong>Description:</strong> {{description}}</p>
<p><strong>Affected Features:</strong> {{affected_features}}</p>
<p><strong>Estimated Resolution:</strong> {{estimated_time}}</p>',
    'html'
);

-- Status Update - Webhook
INSERT OR REPLACE INTO template_contents (template_key, channel_type, content_template, content_type) 
VALUES (
    'status_update',
    'webhook',
    '{
  "service": "{{service_name}}",
  "status": "{{status}}",
  "description": "{{description}}",
  "affected_features": "{{affected_features}}",
  "estimated_time": "{{estimated_time}}"
}',
    'json'
);