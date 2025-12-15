/**
 * AI request handler - proxies requests to OpenAI and Gemini
 */

import { GoogleGenAI } from '@google/genai';

export type AIProvider = 'openai' | 'gemini';
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
      model: 'gpt-5.2-pro',
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
    model: 'gemini-3-pro-preview',
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

export async function handleAIRequest(body: AIRequestBody): Promise<AIResponse> {
  const { provider, prompt, systemPrompt, jsonSchema } = body;

  let text: string;

  if (provider === 'openai') {
    text = await callOpenAI(prompt, systemPrompt);
  } else {
    text = await callGemini(prompt, systemPrompt, jsonSchema);
  }

  return { text };
}

