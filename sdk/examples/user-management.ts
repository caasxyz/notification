import { NotificationClient } from '../src';

const client = new NotificationClient({
  baseUrl: 'https://your-notification-api.com',
  apiKey: 'your-api-key',
});

async function userManagementExample() {
  try {
    // 1. Create a new user
    const newUser = await client.users.create({
      user_id: 'user123',
      name: 'John Doe',
      email: 'john.doe@example.com',
      metadata: {
        department: 'Engineering',
        role: 'Developer',
      },
    });

    console.log('User created:', newUser);

    // 2. Get user details
    const user = await client.users.get('user123');
    console.log('User details:', user);

    // 3. Update user information
    const updatedUser = await client.users.update('user123', {
      name: 'John Smith',
      metadata: {
        department: 'Engineering',
        role: 'Senior Developer',
      },
    });

    console.log('User updated:', updatedUser);

    // 4. List all users
    const userList = await client.users.list({
      limit: 10,
      offset: 0,
    });

    console.log('User list:', userList);

    // 5. Configure notification channels for user
    // Configure Lark
    await client.configs.set('user123', 'lark', {
      channel_type: 'lark',
      config: {
        webhook_url: 'https://open.larksuite.com/open-apis/bot/v2/hook/xxx',
        secret: 'your-lark-secret',
      },
      is_active: true,
    });

    // Configure Email
    await client.configs.set('user123', 'email', {
      channel_type: 'email',
      config: {
        email: 'john.doe@example.com',
      },
      is_active: true,
    });

    // Configure Telegram
    await client.configs.set('user123', 'telegram', {
      channel_type: 'telegram',
      config: {
        bot_token: 'your-bot-token',
        chat_id: 'chat-id',
      },
      is_active: true,
    });

    // 6. List user's configurations
    const configs = await client.configs.list('user123');
    console.log('User configurations:', configs);

    // 7. Deactivate a channel
    await client.configs.deactivate('user123', 'sms');
    console.log('SMS channel deactivated');

    // 8. Activate a channel
    await client.configs.activate('user123', 'sms');
    console.log('SMS channel activated');

  } catch (error) {
    console.error('Error in user management:', error);
  }
}

userManagementExample();