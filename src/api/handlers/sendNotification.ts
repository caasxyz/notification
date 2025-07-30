import { Env, ApiResponse, NotificationResult } from '../../types';
import { NotificationDispatcherV2 } from '../../services/NotificationDispatcherV2';
import { ValidationUtils } from '../../utils/validation';
import { Logger } from '../../utils/logger';

const logger = Logger.getInstance();

export async function sendNotificationHandler(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const body = await request.json();
    const validatedRequest = ValidationUtils.validateSendNotificationRequest(body);

    logger.info('Processing notification request', {
      userId: validatedRequest.user_id,
      channels: validatedRequest.channels,
      hasTemplate: !!validatedRequest.template_key,
      hasCustomContent: !!validatedRequest.custom_content,
      hasIdempotencyKey: !!validatedRequest.idempotency_key,
    });

    const results = await NotificationDispatcherV2.sendNotification(validatedRequest, env);

    const response: ApiResponse<NotificationResult[]> = {
      success: true,
      results,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    logger.error('Send notification failed', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorCode = error instanceof Error && 'code' in error ? 
      (error as { code: string }).code : 
      'UNKNOWN_ERROR';

    const response: ApiResponse = {
      success: false,
      error: errorMessage,
    };

    const statusCode = getStatusCodeForError(errorCode);

    return new Response(JSON.stringify(response), {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}

function getStatusCodeForError(errorCode: string): number {
  switch (errorCode) {
    case 'INVALID_REQUEST':
    case 'INVALID_USER_ID':
    case 'INVALID_CHANNELS':
    case 'INVALID_CHANNEL_TYPE':
    case 'INVALID_TEMPLATE_KEY':
    case 'INVALID_VARIABLES':
    case 'INVALID_CUSTOM_CONTENT':
    case 'INVALID_CONTENT':
    case 'INVALID_SUBJECT':
    case 'MISSING_CONTENT':
    case 'INVALID_IDEMPOTENCY_KEY':
      return 400;
    case 'MISSING_SIGNATURE':
    case 'INVALID_TIMESTAMP':
    case 'REQUEST_EXPIRED':
      return 401;
    case 'DB_ERROR':
    case 'NETWORK_ERROR':
    case 'TIMEOUT_ERROR':
      return 503;
    default:
      return 500;
  }
}