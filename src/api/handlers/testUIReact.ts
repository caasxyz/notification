import { Env } from '../../types';
import { getTestUIHTML } from '../../ui/testUIHtml';

export async function testUIReactHandler(
  _request: Request,
  _env: Env,
): Promise<Response> {
  // Test UI 现在在所有环境中都可用
  // 注意：生产环境中仍需要正确的 API 密钥进行认证

  return new Response(getTestUIHTML(), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}