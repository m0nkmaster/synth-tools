/**
 * AWS Lambda handler for AI requests
 * Thin wrapper around the shared ai-handler
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { handleAIRequest, type AIRequestBody } from '../server/ai-handler';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  // Handle CORS preflight
  if (event.requestContext.http.method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  // Health check
  if (event.rawPath === '/api/health') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ status: 'ok' }),
    };
  }

  // AI generation endpoint
  if (
    event.rawPath === '/api/ai/generate' &&
    event.requestContext.http.method === 'POST'
  ) {
    try {
      if (!event.body) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Request body required' }),
        };
      }

      const body: AIRequestBody = JSON.parse(
        event.isBase64Encoded
          ? Buffer.from(event.body, 'base64').toString()
          : event.body
      );

      const result = await handleAIRequest(body);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(result),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('AI request error:', message);

      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: message }),
      };
    }
  }

  return {
    statusCode: 404,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Not found' }),
  };
};

