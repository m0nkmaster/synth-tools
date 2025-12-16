/**
 * AI request handler - proxies requests to OpenAI, Gemini, and Anthropic
 */

import { GoogleGenAI } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';

export type AIProvider = 'openai' | 'gemini' | 'anthropic';
export type AIAction = 'generate' | 'batch' | 'plan';

export interface AIRequestBody {
  provider: AIProvider;
  action: AIAction;
  prompt: string;
  systemPrompt: string;
  /** For batch generation */
  ideas?: Array<{ name: string; description: string; category: string }>;
  /** For kit planning - use JSON schema */
  jsonSchema?: Record<string, unknown>;
}

export interface AIResponse {
  text: string;
}

// Temperature for Anthropic (OpenAI responses API and Gemini don't support it reliably)
const ANTHROPIC_TEMPERATURE = 0.7;

function getOpenAIKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not set');
  return key;
}

function getGeminiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set');
  return key;
}

function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL || 'gpt-4.1-mini';
}

function getGeminiModel(): string {
  return process.env.GEMINI_MODEL || 'gemini-2.0-flash';
}

function getAnthropicKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not set');
  return key;
}

function getAnthropicModel(): string {
  return process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
}

async function callOpenAI(
  prompt: string,
  systemPrompt: string
): Promise<string> {
  const apiKey = getOpenAIKey();

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: getOpenAIModel(),
      instructions: systemPrompt,
      input: prompt,
      text: {
        format: { type: 'json_object' },
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `OpenAI: ${(errorData as { error?: { message?: string } }).error?.message || response.statusText}`
    );
  }

  const data = await response.json();

  type OutputItem = {
    type: string;
    content?: { type: string; text?: string }[];
  };
  const outputText = (data as { output?: OutputItem[] }).output
    ?.find((item: OutputItem) => item.type === 'message')
    ?.content?.find(
      (c: { type: string; text?: string }) => c.type === 'output_text'
    )?.text;

  if (!outputText) {
    console.error('OpenAI Raw Response:', JSON.stringify(data, null, 2));
    throw new Error('OpenAI: No text generated');
  }

  return outputText;
}

async function callGemini(
  prompt: string,
  systemPrompt: string,
  jsonSchema?: Record<string, unknown>
): Promise<string> {
  const apiKey = getGeminiKey();
  const ai = new GoogleGenAI({ apiKey });

  const config: {
    systemInstruction: string;
    responseMimeType: string;
    responseJsonSchema?: Record<string, unknown>;
  } = {
    systemInstruction: systemPrompt,
    responseMimeType: 'application/json',
  };

  if (jsonSchema) {
    config.responseJsonSchema = jsonSchema;
  }

  const response = await ai.models.generateContent({
    model: getGeminiModel(),
    contents: prompt,
    config,
  });

  let text: string | undefined;
  if (typeof (response as unknown as { text: () => string }).text === 'function') {
    text = (response as unknown as { text: () => string }).text();
  } else if (typeof response.text === 'string') {
    text = response.text;
  } else if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
    text = response.candidates[0].content.parts[0].text;
  }

  if (!text) {
    console.error('Gemini Raw Response:', JSON.stringify(response, null, 2));
    throw new Error('Gemini: No text generated');
  }

  return text;
}

async function callAnthropic(
  prompt: string,
  systemPrompt: string
): Promise<string> {
  const client = new Anthropic({ apiKey: getAnthropicKey() });

  const message = await client.messages.create({
    model: getAnthropicModel(),
    max_tokens: 32768,
    temperature: ANTHROPIC_TEMPERATURE,
    system: systemPrompt,
    messages: [{ role: 'user', content: `${prompt}\n\nReturn raw JSON only, no markdown.` }],
  });

  const textBlock = message.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    console.error('Anthropic Raw Response:', JSON.stringify(message, null, 2));
    throw new Error('Anthropic: No text generated');
  }

  return textBlock.text;
}

export async function handleAIRequest(body: AIRequestBody): Promise<AIResponse> {
  const { provider, prompt, systemPrompt, jsonSchema } = body;

  let text: string;

  if (provider === 'openai') {
    text = await callOpenAI(prompt, systemPrompt);
  } else if (provider === 'anthropic') {
    text = await callAnthropic(prompt, systemPrompt);
  } else {
    text = await callGemini(prompt, systemPrompt, jsonSchema);
  }

  return { text };
}

