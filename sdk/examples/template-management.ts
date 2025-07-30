import { NotificationClient, TemplateRenderer } from '../src';

const client = new NotificationClient({
  baseUrl: 'https://your-notification-api.com',
  apiKey: 'your-api-key',
});

async function templateManagementExample() {
  try {
    // 1. Create a new template
    await client.templates.create('welcome_email', {
      name: 'Welcome Email',
      description: 'Email sent to new users upon registration',
      subject_template: 'Welcome to {{company}}, {{name}}!',
      content_template: `
Hello {{name}},

Welcome to {{company}}! We're excited to have you on board.

Your account has been successfully created. Here are your next steps:
1. Complete your profile
2. Explore our features
3. Join our community

If you have any questions, feel free to reach out to our support team.

Best regards,
The {{company}} Team
      `.trim(),
      allowed_channels: ['email', 'lark'],
      default_variables: {
        company: 'Our Platform',
      },
    });

    console.log('Template created successfully');

    // 2. Get template details
    const template = await client.templates.get('welcome_email');
    console.log('Template details:', template);

    // 3. List all templates
    const templates = await client.templates.list();
    console.log('All templates:', templates);

    // 4. Update template
    await client.templates.update('welcome_email', {
      description: 'Updated welcome email for new users',
      allowed_channels: ['email', 'lark', 'telegram'],
    });

    console.log('Template updated successfully');

    // 5. Render template with variables (server-side)
    const rendered = await client.templates.render('welcome_email', {
      name: 'John Doe',
      company: 'Acme Corp',
    });

    console.log('Rendered template:', rendered);

    // 6. Local template rendering (client-side)
    const localTemplate = 'Hello {{name}}, welcome to {{company}}!';
    const localRendered = TemplateRenderer.render(localTemplate, {
      name: 'Jane Smith',
      company: 'Tech Co',
    });

    console.log('Locally rendered:', localRendered);

    // 7. Extract and validate template variables
    const variables = TemplateRenderer.extractVariables(localTemplate);
    console.log('Template variables:', variables);

    const validation = TemplateRenderer.validateVariables(localTemplate, {
      name: 'John',
      // Missing 'company' variable
    });

    console.log('Validation result:', validation);

    // 8. Create multi-channel template
    await client.templates.create('system_alert', {
      name: 'System Alert',
      description: 'Critical system alerts',
      subject_template: '🚨 Alert: {{alert_type}}',
      content_template: `
Alert Type: {{alert_type}}
Severity: {{severity}}
Time: {{timestamp}}

Description:
{{description}}

Action Required:
{{action}}
      `.trim(),
      allowed_channels: ['email', 'lark', 'telegram', 'webhook', 'sms'],
      default_variables: {
        severity: 'High',
        action: 'Please investigate immediately',
      },
    });

    console.log('Multi-channel template created');

  } catch (error) {
    console.error('Error in template management:', error);
  }
}

templateManagementExample();