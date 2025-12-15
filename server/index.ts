/**
 * API server for proxying AI requests
 * Keeps API keys secure on the server side
 */

import { handleAIRequest, type AIRequestBody } from './ai-handler';

const PORT = process.env.PORT || 3001;

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // CORS headers for development
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check
    if (url.pathname === '/api/health') {
      return Response.json({ status: 'ok' }, { headers: corsHeaders });
    }

    // AI generation endpoint
    if (url.pathname === '/api/ai/generate' && req.method === 'POST') {
      try {
        const body = (await req.json()) as AIRequestBody;
        const result = await handleAIRequest(body);
        return Response.json(result, { headers: corsHeaders });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return Response.json(
          { error: message },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    return Response.json(
      { error: 'Not found' },
      { status: 404, headers: corsHeaders }
    );
  },
});

console.log(`🚀 API server running on http://localhost:${server.port}`);

