/**
 * src/ai-provider.ts
 *
 * Provider abstraction layer for LeadForge AI.
 *
 * All five providers — Anthropic (Claude), Groq, Google Gemini, Ollama, and
 * OpenRouter — implement the same `AIProvider` interface, so researcher.ts and
 * personalizer.ts are completely agnostic of which backend is active.
 *
 * The active provider is resolved at runtime from data/settings.json via
 * server/settings.ts, making it hot-switchable from the UI without a restart.
 *
 * ── Provider Notes ────────────────────────────────────────────────────────────
 *
 *  Anthropic    Uses the official @anthropic-ai/sdk with ephemeral prompt
 *               caching on the system prompt (saves ~80% on repeat calls).
 *
 *  Groq         Uses groq-sdk. Extremely fast (LPU inference). Free tier covers
 *               typical B2B prospecting volumes easily.
 *               Recommended models: llama-3.3-70b-versatile, mixtral-8x7b-32768
 *
 *  Gemini       Uses @google/generative-ai. gemini-1.5-flash is free via
 *               Google AI Studio with a generous rate limit.
 *               Recommended models: gemini-1.5-flash, gemini-1.5-pro
 *
 *  Ollama       Fully local — zero API cost, zero data sent externally.
 *               Uses the OpenAI-compatible REST API Ollama exposes on :11434.
 *               Recommended models: llama3.2, mistral, qwen2.5
 *
 *  OpenRouter   One API key, 50+ models. Many are permanently free
 *               (e.g. meta-llama/llama-3.1-8b-instruct:free).
 *               Uses the OpenAI-compatible API.
 */

import Anthropic from '@anthropic-ai/sdk';
import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

export type ProviderName = 'anthropic' | 'groq' | 'gemini' | 'ollama' | 'openrouter';

export interface ProviderConfig {
  name: ProviderName;
  apiKey?: string;
  model: string;
  baseUrl?: string; // Used by Ollama (and optionally OpenRouter)
}

export interface AIProvider {
  /** Send a system prompt + user message and return the raw text response. */
  complete(systemPrompt: string, userMessage: string, maxTokens?: number): Promise<string>;
}

// ── Anthropic (Claude) ────────────────────────────────────────────────────────

class AnthropicProvider implements AIProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async complete(systemPrompt: string, userMessage: string, maxTokens = 1024): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          // Ephemeral cache — saves ~80% on repeated lead runs
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    });
    return response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as Anthropic.TextBlock).text)
      .join('');
  }
}

// ── Groq ─────────────────────────────────────────────────────────────────────

class GroqProvider implements AIProvider {
  private client: Groq;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new Groq({ apiKey });
    this.model = model;
  }

  async complete(systemPrompt: string, userMessage: string, maxTokens = 1024): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage },
      ],
    });
    return response.choices[0]?.message?.content ?? '';
  }
}

// ── Google Gemini ─────────────────────────────────────────────────────────────

class GeminiProvider implements AIProvider {
  private client: GoogleGenerativeAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = model;
  }

  async complete(systemPrompt: string, userMessage: string, maxTokens = 1024): Promise<string> {
    const genModel = this.client.getGenerativeModel({
      model: this.model,
      systemInstruction: systemPrompt,
      generationConfig: { maxOutputTokens: maxTokens },
    });
    const result = await genModel.generateContent(userMessage);
    return result.response.text();
  }
}

// ── Ollama (local) ────────────────────────────────────────────────────────────

class OllamaProvider implements AIProvider {
  private client: OpenAI;
  private model: string;

  constructor(baseUrl: string, model: string) {
    // Ollama exposes an OpenAI-compatible API
    this.client = new OpenAI({
      apiKey: 'ollama',
      baseURL: baseUrl.replace(/\/$/, '') + '/v1',
    });
    this.model = model;
  }

  async complete(systemPrompt: string, userMessage: string, maxTokens = 1024): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage },
      ],
    });
    return response.choices[0]?.message?.content ?? '';
  }
}

// ── OpenRouter ────────────────────────────────────────────────────────────────

class OpenRouterProvider implements AIProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://github.com/melvin-akino/b2b-lead-scraper',
        'X-Title': 'LeadForge AI',
      },
    });
    this.model = model;
  }

  async complete(systemPrompt: string, userMessage: string, maxTokens = 1024): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage },
      ],
    });
    return response.choices[0]?.message?.content ?? '';
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Creates an AIProvider instance from a ProviderConfig.
 * Called fresh before each pipeline run so settings changes take effect immediately.
 */
export function createProvider(config: ProviderConfig): AIProvider {
  switch (config.name) {
    case 'anthropic':
      if (!config.apiKey) throw new Error('Anthropic API key is required.');
      return new AnthropicProvider(config.apiKey, config.model);

    case 'groq':
      if (!config.apiKey) throw new Error('Groq API key is required.');
      return new GroqProvider(config.apiKey, config.model);

    case 'gemini':
      if (!config.apiKey) throw new Error('Gemini API key is required.');
      return new GeminiProvider(config.apiKey, config.model);

    case 'ollama':
      return new OllamaProvider(
        config.baseUrl ?? 'http://localhost:11434',
        config.model
      );

    case 'openrouter':
      if (!config.apiKey) throw new Error('OpenRouter API key is required.');
      return new OpenRouterProvider(config.apiKey, config.model);

    default:
      throw new Error(`Unknown provider: ${config.name}`);
  }
}

// ── Default models per provider ───────────────────────────────────────────────

export const DEFAULT_MODELS: Record<ProviderName, string> = {
  anthropic:   'claude-sonnet-4-6',
  groq:        'llama-3.3-70b-versatile',
  gemini:      'gemini-1.5-flash',
  ollama:      'llama3.2',
  openrouter:  'meta-llama/llama-3.1-8b-instruct:free',
};

export const PROVIDER_MODELS: Record<ProviderName, { value: string; label: string }[]> = {
  anthropic: [
    { value: 'claude-sonnet-4-6',           label: 'Claude Sonnet 4.6 (recommended)' },
    { value: 'claude-opus-4-5',             label: 'Claude Opus 4.5 (most powerful)' },
    { value: 'claude-haiku-4-5-20251001',   label: 'Claude Haiku 4.5 (fastest)' },
  ],
  groq: [
    { value: 'llama-3.3-70b-versatile',     label: 'Llama 3.3 70B Versatile (recommended)' },
    { value: 'llama-3.1-8b-instant',        label: 'Llama 3.1 8B Instant (fastest)' },
    { value: 'mixtral-8x7b-32768',          label: 'Mixtral 8x7B (long context)' },
    { value: 'gemma2-9b-it',               label: 'Gemma 2 9B (Google)' },
  ],
  gemini: [
    { value: 'gemini-1.5-flash',            label: 'Gemini 1.5 Flash (free, recommended)' },
    { value: 'gemini-1.5-pro',             label: 'Gemini 1.5 Pro (most capable)' },
    { value: 'gemini-2.0-flash',            label: 'Gemini 2.0 Flash (latest)' },
  ],
  ollama: [
    { value: 'llama3.2',                   label: 'Llama 3.2 (recommended)' },
    { value: 'llama3.1',                   label: 'Llama 3.1' },
    { value: 'mistral',                    label: 'Mistral 7B' },
    { value: 'qwen2.5',                   label: 'Qwen 2.5' },
    { value: 'phi3',                       label: 'Phi-3 (lightweight)' },
  ],
  openrouter: [
    { value: 'meta-llama/llama-3.1-8b-instruct:free',   label: 'Llama 3.1 8B (free)' },
    { value: 'meta-llama/llama-3.2-3b-instruct:free',   label: 'Llama 3.2 3B (free)' },
    { value: 'google/gemma-2-9b-it:free',               label: 'Gemma 2 9B (free)' },
    { value: 'mistralai/mistral-7b-instruct:free',       label: 'Mistral 7B (free)' },
    { value: 'microsoft/phi-3-mini-128k-instruct:free',  label: 'Phi-3 Mini (free)' },
  ],
};
