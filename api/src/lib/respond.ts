import type { HttpResponseInit } from '@azure/functions';

const BASE_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
};

export function corsHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
  return { ...BASE_CORS_HEADERS, ...(extraHeaders ?? {}) };
}

/**
 * Build a JSON HttpResponseInit with permissive CORS headers.
 */
export function json(status: number, body: unknown, extraHeaders?: Record<string, string>): HttpResponseInit {
  return {
    status,
    jsonBody: body,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(extraHeaders),
    },
  };
}

/**
 * Build a standardized `{ error: { code, message } }` JSON error response.
 */
export function errorResponse(
  status: number,
  code: string,
  message: string,
  extraHeaders?: Record<string, string>
): HttpResponseInit {
  return json(status, { error: { code, message } }, extraHeaders);
}

/**
 * 204 No Content response for CORS preflight (OPTIONS) requests.
 */
export function preflightResponse(): HttpResponseInit {
  return {
    status: 204,
    headers: corsHeaders(),
  };
}
