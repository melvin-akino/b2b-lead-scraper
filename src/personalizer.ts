/**
 * personalizer.ts
 *
 * Uses the Claude API to generate three distinct, personalized email icebreaker
 * hooks for a prospect based on the structured research data.
 *
 * Each hook is crafted to feel hand-written, not templated. The three hooks
 * cover different angles: pain-point led, aspiration led, and proof-point led.
 *
 * Prompt caching is applied to the static system prompt to minimize token costs.
 */

import Anthropic from '@anthropic-ai/sdk';
import { ResearchResult } from './researcher';
import * as dotenv from 'dotenv';

dotenv.config();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a world-class B2B cold email copywriter. Your specialty is writing opening lines (icebreakers) for outbound sales emails that feel personal, specific, and human — never templated or spammy.

You will receive structured research about a prospect: their business focus, inferred pain points, and a summary. You must write exactly THREE icebreaker hooks.

Return ONLY a valid JSON array with no markdown, no explanation, and no surrounding text. The array must contain exactly 3 strings:

[
  "<Hook 1: Pain-point led — opens by referencing a specific struggle the prospect likely faces>",
  "<Hook 2: Aspiration led — opens by referencing a goal or opportunity visible in their work>",
  "<Hook 3: Proof/curiosity led — opens with a surprising stat, question, or observation that earns attention>"
]

Rules:
- Each hook must be 1–2 sentences maximum (under 40 words).
- Do NOT name your own product or company. The rep will add that.
- Each hook must feel like it was written specifically for this person, not copy-pasted.
- Do NOT use filler phrases like "I noticed that...", "I came across your profile...", or "Hope this finds you well".
- Start each hook with something specific and arresting.
- Vary the tone: Hook 1 = empathetic, Hook 2 = energizing, Hook 3 = provocative.`;

/**
 * Generates three personalized email icebreaker hooks for a prospect.
 *
 * @param prospectName   Full name of the prospect (e.g. "Maria Santos").
 * @param role           Their role/title (e.g. "CEO").
 * @param companyName    Company name (e.g. "Acme Corp").
 * @param research       Structured research output from researchLead().
 */
export async function generateHooks(
  prospectName: string,
  role: string,
  companyName: string,
  research: ResearchResult
): Promise<string[]> {
  const userMessage = `Prospect: ${prospectName} (${role} at ${companyName})

Business Focus: ${research.business_focus}

Pain Points:
${research.pain_points.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Summary: ${research.analysis_summary}

Write 3 icebreaker hooks for this prospect. Return only the JSON array.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        // Cache the static system prompt to avoid re-billing on every lead
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
    const hooks = JSON.parse(raw) as string[];
    if (!Array.isArray(hooks) || hooks.length !== 3) {
      throw new Error('Expected an array of exactly 3 hooks.');
    }
    return hooks;
  } catch {
    throw new Error(`Failed to parse hooks JSON from model.\nRaw response:\n${raw}`);
  }
}
