/**
 * researcher.ts
 *
 * Analyzes raw scraped content via the active AI provider and returns:
 *   - business_focus  — 1-2 sentence summary of what the company is working on
 *   - pain_points[]   — 3 specific, inferred pain points
 *   - analysis_summary — 3-4 sentence briefing note for the sales rep
 *
 * The AI provider is resolved from settings at call time, so switching
 * providers in the UI takes effect on the next pipeline run without restart.
 * Prompt caching is applied automatically when the Anthropic provider is active.
 */

import { createProvider, ProviderConfig } from './ai-provider';
import * as dotenv from 'dotenv';

dotenv.config();

const SYSTEM_PROMPT = `You are an expert B2B sales researcher. Your job is to analyze scraped web content about a company or individual prospect and extract structured intelligence that a sales rep can use to open a conversation.

You must return ONLY a valid JSON object with no markdown, no explanation, and no surrounding text. The JSON must match this exact shape:

{
  "business_focus": "<1–2 sentence summary of what this company/person is currently focused on>",
  "pain_points": [
    "<specific pain point 1 inferred from the content>",
    "<specific pain point 2 inferred from the content>",
    "<specific pain point 3 inferred from the content>"
  ],
  "analysis_summary": "<3–4 sentence narrative combining focus and pain points in a way a sales rep can read quickly>"
}

Rules:
- Pain points must be SPECIFIC and INFERRED from the actual content, not generic.
- If the content is thin, make reasonable inferences but do not fabricate facts.
- Keep business_focus under 50 words.
- Keep each pain point under 20 words.
- analysis_summary should read like a briefing note, not a marketing pitch.`;

export interface ResearchResult {
  business_focus: string;
  pain_points: string[];
  analysis_summary: string;
}

/**
 * Analyzes scraped content for a single prospect and returns structured research.
 *
 * @param rawContent    The full text scraped from the prospect's website / LinkedIn.
 * @param context       Optional context string (e.g. "SaaS founder in Manila") to guide the model.
 * @param providerConfig The AI provider config to use (resolved from settings at runtime).
 */
export async function researchLead(
  rawContent: string,
  context?: string,
  providerConfig?: ProviderConfig
): Promise<ResearchResult> {
  const provider = createProvider(
    providerConfig ?? {
      name: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: 'claude-sonnet-4-6',
    }
  );

  const userMessage = [
    context ? `Context about this prospect: ${context}\n` : '',
    '--- SCRAPED CONTENT START ---',
    rawContent.slice(0, 12_000),
    '--- SCRAPED CONTENT END ---',
    '',
    'Analyze the content above and return the JSON object as instructed.',
  ]
    .filter(Boolean)
    .join('\n');

  const raw = await provider.complete(SYSTEM_PROMPT, userMessage, 1024);

  // Strip markdown code fences if the model wraps the JSON (some providers do this)
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  try {
    return JSON.parse(cleaned) as ResearchResult;
  } catch {
    throw new Error(`Failed to parse research JSON.\nRaw response:\n${raw}`);
  }
}
