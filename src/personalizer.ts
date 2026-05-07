/**
 * personalizer.ts
 *
 * Generates three distinct email icebreaker hooks for a prospect based on
 * structured research data, using the active AI provider.
 *
 * Hook angles:
 *   1. Pain-point led   — empathetic, references a specific struggle
 *   2. Aspiration led   — energizing, references a visible goal or opportunity
 *   3. Proof/curiosity  — provocative, uses a stat, question, or observation
 *
 * The AI provider is resolved from settings at call time.
 */

import { createProvider, ProviderConfig } from './ai-provider';
import { ResearchResult } from './researcher';
import * as dotenv from 'dotenv';

dotenv.config();

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
 * @param prospectName    Full name of the prospect (e.g. "Maria Santos").
 * @param role            Their role/title (e.g. "CEO").
 * @param companyName     Company name (e.g. "Acme Corp").
 * @param research        Structured research output from researchLead().
 * @param providerConfig  The AI provider config to use (resolved from settings at runtime).
 */
export async function generateHooks(
  prospectName: string,
  role: string,
  companyName: string,
  research: ResearchResult,
  providerConfig?: ProviderConfig
): Promise<string[]> {
  const provider = createProvider(
    providerConfig ?? {
      name: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: 'claude-sonnet-4-6',
    }
  );

  const userMessage = `Prospect: ${prospectName} (${role} at ${companyName})

Business Focus: ${research.business_focus}

Pain Points:
${research.pain_points.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Summary: ${research.analysis_summary}

Write 3 icebreaker hooks for this prospect. Return only the JSON array.`;

  const raw = await provider.complete(SYSTEM_PROMPT, userMessage, 512);
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  try {
    const hooks = JSON.parse(cleaned) as string[];
    if (!Array.isArray(hooks) || hooks.length !== 3) {
      throw new Error('Expected an array of exactly 3 hooks.');
    }
    return hooks;
  } catch {
    throw new Error(`Failed to parse hooks JSON.\nRaw response:\n${raw}`);
  }
}
