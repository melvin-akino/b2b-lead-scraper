/**
 * researcher.ts
 *
 * Uses the Claude API to analyze raw scraped content and extract:
 *   - A concise summary of the prospect's current business focus
 *   - An array of inferred pain points (drawn from recent news, posts, or copy)
 *
 * Prompt caching is enabled on the static system prompt to cut API costs
 * on repeated runs. Only the per-lead user content is billed at full price.
 */

import Anthropic from '@anthropic-ai/sdk';
import * as dotenv from 'dotenv';

dotenv.config();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
 * @param rawContent  The full text scraped from the prospect's website / LinkedIn.
 * @param context     Optional context string (e.g. "SaaS founder in Manila") to guide the model.
 */
export async function researchLead(
  rawContent: string,
  context?: string
): Promise<ResearchResult> {
  const userMessage = [
    context ? `Context about this prospect: ${context}\n` : '',
    '--- SCRAPED CONTENT START ---',
    rawContent.slice(0, 12_000), // cap to avoid exceeding context limits
    '--- SCRAPED CONTENT END ---',
    '',
    'Analyze the content above and return the JSON object as instructed.',
  ]
    .filter(Boolean)
    .join('\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        // Cache the static system prompt — saves ~80% on repeated lead runs
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userMessage }],
  });

  const raw = response.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as Anthropic.TextBlock).text)
    .join('');

  try {
    const parsed = JSON.parse(raw) as ResearchResult;
    return parsed;
  } catch {
    // Surface the raw response in the error so the caller can debug
    throw new Error(`Failed to parse research JSON from model.\nRaw response:\n${raw}`);
  }
}
