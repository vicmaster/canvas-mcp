// Phase 6a → Phase 13: LLM-as-judge for `canvas_evaluate`. Takes a PNG of the
// rendered canvas and asks a vision model for a structured critique against a
// FIXED multi-axis rubric (not one opaque number). Providers are pluggable via
// a single `judges` table — adding a third (Gemini, Groq, …) is a one-line
// addition once a Judge function is written.

export type Provider = 'anthropic' | 'openai';

/** Fixed critique rubric — a closed set of named axes, each scored 1–5. Stable
 * names: `restraint` is the LLM-judged sibling of Phase 12's deterministic
 * `cliche`; `variety` mirrors Phase 11's structure axes. */
export const RUBRIC_AXES = ['hierarchy', 'execution', 'specificity', 'restraint', 'variety'] as const;
export type RubricAxis = (typeof RUBRIC_AXES)[number];

export interface AxisScore {
  score: number;       // 1–5
  rationale: string;   // one line
}
export type Rubric = Record<RubricAxis, AxisScore>;

/** An axis below the floor is recorded here, naming what to fix. */
export interface FailingAxis {
  axis: RubricAxis;
  score: number;
  rationale: string;
}

export interface LLMJudgeResult {
  provider: Provider;
  model: string;
  rubric: Rubric;
  /** 0–100, DERIVED from the rubric: round(mean(axisScores) / 5 * 100). */
  score: number;
  summary: string;          // 1–2 sentences
  suggestions: string[];    // concrete fixes
  /** Any axis < floor. */
  needsRevision: boolean;
  failingAxes: FailingAxis[];
}

export type Judge = (screenshotPngBase64: string) => Promise<Omit<LLMJudgeResult, 'needsRevision' | 'failingAxes'>>;

/** Default per-axis floor (of 5). Overridable per call or via env. */
export const DEFAULT_CRITIQUE_FLOOR = 3;
export function resolveFloor(floor?: number): number {
  if (typeof floor === 'number' && floor >= 1 && floor <= 5) return floor;
  const env = Number(process.env.FRAMESMITH_CRITIQUE_FLOOR);
  if (env >= 1 && env <= 5) return env;
  return DEFAULT_CRITIQUE_FLOOR;
}

const AXIS_GUIDE = `- hierarchy: clear focal order / scan path; the eye knows where to go first.
- execution: craft — alignment, spacing rhythm, consistency, contrast.
- specificity: feels designed for a real, particular purpose, not a generic template.
- restraint: avoids overdone effects (gratuitous gradients, glows, default purple, fake chrome).
- variety: avoids same-shape sameness; a considered layout, not the default centered hero.`;

const SYSTEM_PROMPT = `You are a senior visual designer reviewing a rendered web design against a FIXED rubric. You will be shown a screenshot. Score each of these five axes from 1 (poor) to 5 (excellent), each with a one-line rationale referencing what you see:
${AXIS_GUIDE}

Output STRICT JSON only — no prose before or after, no markdown fences — matching this schema:
{
  "rubric": {
    "hierarchy":   { "score": 1-5, "rationale": string },
    "execution":   { "score": 1-5, "rationale": string },
    "specificity": { "score": 1-5, "rationale": string },
    "restraint":   { "score": 1-5, "rationale": string },
    "variety":     { "score": 1-5, "rationale": string }
  },
  "summary": string (1–2 sentences),
  "suggestions": string[] (up to 5 concrete fixes)
}
Be specific. Reference what you see in the image. Do not assume context that isn't visible.`;

const USER_PROMPT = `Evaluate this rendered design against the rubric. Return the JSON object only.`;

export function pickProvider(): Provider | null {
  const forced = process.env.FRAMESMITH_LLM_PROVIDER;
  if (forced === 'anthropic' || forced === 'openai') return forced;
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.OPENAI_API_KEY) return 'openai';
  return null;
}

export class LLMJudgeUnavailableError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'LLMJudgeUnavailableError';
  }
}

export async function judgeCanvas(
  screenshotPngBase64: string,
  opts: { provider?: Provider; floor?: number } = {},
): Promise<LLMJudgeResult> {
  const provider = opts.provider ?? pickProvider();
  if (!provider) {
    throw new LLMJudgeUnavailableError(
      'No LLM provider configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY (or FRAMESMITH_LLM_PROVIDER=anthropic|openai to pick one explicitly).',
    );
  }
  const base = await judges[provider](screenshotPngBase64);
  return withVerdict(base, opts.floor);
}

/** Attach the floor-derived verdict (needsRevision + failingAxes) to a parsed
 * critique. Split out so the closed-loop revise tool can re-derive it. */
export function withVerdict(
  base: Omit<LLMJudgeResult, 'needsRevision' | 'failingAxes'>,
  floor?: number,
): LLMJudgeResult {
  const f = resolveFloor(floor);
  const failingAxes: FailingAxis[] = RUBRIC_AXES
    .filter((axis) => base.rubric[axis].score < f)
    .map((axis) => ({ axis, score: base.rubric[axis].score, rationale: base.rubric[axis].rationale }));
  return { ...base, needsRevision: failingAxes.length > 0, failingAxes };
}

// ---- Provider adapters ----

async function judgeWithAnthropic(screenshotPngBase64: string) {
  // Dynamic import keeps the SDK out of the critical path for users who never
  // call llm-mode evaluation (the rest of framesmith works without it).
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic();
  const model = process.env.FRAMESMITH_LLM_ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';
  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: screenshotPngBase64 } },
          { type: 'text', text: USER_PROMPT },
        ],
      },
    ],
  });
  const text = response.content
    .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('');
  return { provider: 'anthropic' as const, model, ...parseRubric(text) };
}

async function judgeWithOpenAI(screenshotPngBase64: string) {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI();
  const model = process.env.FRAMESMITH_LLM_OPENAI_MODEL ?? 'gpt-4.1';
  const response = await client.chat.completions.create({
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: USER_PROMPT },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${screenshotPngBase64}` } },
        ],
      },
    ],
  });
  const text = response.choices[0]?.message?.content ?? '';
  return { provider: 'openai' as const, model, ...parseRubric(text) };
}

export const judges: Record<Provider, Judge> = {
  anthropic: judgeWithAnthropic,
  openai: judgeWithOpenAI,
};

// ---- Response parsing ----

const clampAxis = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(1, Math.min(5, Math.round(v))) : 3;

/** Parse a rubric critique from raw model text. Throws only on non-JSON (mirrors
 * the old behavior); a missing axis defaults to a neutral 3 with an empty
 * rationale (never throws mid-eval), and a defaulted 3 won't trip the floor (3 ≥ 3). */
export function parseRubric(text: string): Omit<LLMJudgeResult, 'provider' | 'model' | 'needsRevision' | 'failingAxes'> {
  const cleaned = text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  let obj: unknown;
  try {
    obj = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`LLM did not return valid JSON: ${(err as Error).message}. Raw output: ${text.slice(0, 200)}`);
  }
  if (!obj || typeof obj !== 'object') throw new Error('LLM response was not a JSON object.');
  const rec = obj as Record<string, unknown>;
  const rawRubric = (rec.rubric ?? {}) as Record<string, unknown>;

  const rubric = {} as Rubric;
  for (const axis of RUBRIC_AXES) {
    const entry = (rawRubric[axis] ?? {}) as Record<string, unknown>;
    rubric[axis] = {
      score: clampAxis(entry.score),
      rationale: typeof entry.rationale === 'string' ? entry.rationale : '',
    };
  }

  const mean = RUBRIC_AXES.reduce((s, a) => s + rubric[a].score, 0) / RUBRIC_AXES.length;
  const score = Math.round((mean / 5) * 100);
  const asStringArray = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

  return {
    rubric,
    score,
    summary: typeof rec.summary === 'string' ? rec.summary : '',
    suggestions: asStringArray(rec.suggestions),
  };
}

// ── Phase 26 slice C — the multi-screen FLOW critique ───────────────────────
// One judge call over a screen SET, scoring qualities that only exist across
// screens (the Nielsen-heuristic layer a single screenshot can't show).
// Same provider table pattern, same fixed-rubric parsing contract, same
// graceful no-key behavior — and the same actionability rule: every note
// names the screen it's about.

export const FLOW_AXES = ['navigation-consistency', 'terminology-consistency', 'state-visibility', 'hierarchy-consistency'] as const;
export type FlowAxis = (typeof FLOW_AXES)[number];

export interface FlowScreenNote {
  /** One of the screen names provided to the judge — notes that name unknown
   * screens are dropped in parsing (anchoring must stay honest). */
  screen: string;
  note: string;
}

export interface FlowCritiqueResult {
  provider: Provider;
  model: string;
  rubric: Record<FlowAxis, AxisScore>;
  /** 0–100, derived: round(mean(axisScores) / 5 * 100). */
  score: number;
  summary: string;
  screenNotes: FlowScreenNote[];
}

export type FlowScreen = { name: string; png: string };
export type FlowJudge = (screens: FlowScreen[]) => Promise<FlowCritiqueResult>;

const FLOW_AXIS_GUIDE = `- navigation-consistency: the same navigation appears in the same place with the same items on every screen; the active state moves, the structure doesn't.
- terminology-consistency: a concept keeps ONE name across screens (no "Members" on one screen becoming "Users" on the next); labels, casing, and iconography agree.
- state-visibility: every action visible across the flow has a visible result somewhere — status, confirmation, count changes; nothing happens silently.
- hierarchy-consistency: headings, spacing rhythm, and emphasis follow the same system on every screen; no screen feels like it came from a different product.`;

const FLOW_SYSTEM_PROMPT = `You are a senior product designer reviewing a FLOW — several screens of one product, shown in order. Score each of these four axes from 1 (poor) to 5 (excellent), each with a one-line rationale referencing specific screens BY NAME:
${FLOW_AXIS_GUIDE}

Output STRICT JSON only — no prose before or after, no markdown fences — matching this schema:
{
  "rubric": {
    "navigation-consistency":  { "score": 1-5, "rationale": string },
    "terminology-consistency": { "score": 1-5, "rationale": string },
    "state-visibility":        { "score": 1-5, "rationale": string },
    "hierarchy-consistency":   { "score": 1-5, "rationale": string }
  },
  "summary": string (1-2 sentences about the flow as a whole),
  "screenNotes": [{ "screen": string (EXACTLY one of the provided screen names), "note": string (one concrete, actionable observation) }]
}
Reference only what is visible. Use the provided screen names exactly.`;

export function parseFlowRubric(text: string, screenNames: string[]): Omit<FlowCritiqueResult, 'provider' | 'model'> {
  const cleaned = text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  let obj: unknown;
  try {
    obj = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`LLM did not return valid JSON: ${(err as Error).message}. Raw output: ${text.slice(0, 200)}`);
  }
  if (!obj || typeof obj !== 'object') throw new Error('LLM response was not a JSON object.');
  const rec = obj as Record<string, unknown>;
  const rawRubric = (rec.rubric ?? {}) as Record<string, unknown>;

  const rubric = {} as Record<FlowAxis, AxisScore>;
  for (const axis of FLOW_AXES) {
    const entry = (rawRubric[axis] ?? {}) as Record<string, unknown>;
    rubric[axis] = {
      score: clampAxis(entry.score),
      rationale: typeof entry.rationale === 'string' ? entry.rationale : '',
    };
  }
  const mean = FLOW_AXES.reduce((s, a) => s + rubric[a].score, 0) / FLOW_AXES.length;

  const known = new Set(screenNames);
  const screenNotes: FlowScreenNote[] = (Array.isArray(rec.screenNotes) ? rec.screenNotes : [])
    .filter((n): n is { screen: string; note: string } =>
      !!n && typeof (n as Record<string, unknown>).screen === 'string' && typeof (n as Record<string, unknown>).note === 'string')
    .filter((n) => known.has(n.screen));

  return {
    rubric,
    score: Math.round((mean / 5) * 100),
    summary: typeof rec.summary === 'string' ? rec.summary : '',
    screenNotes,
  };
}

/** Interleave "Screen: <name>" labels with images so the judge can anchor
 * notes to names — the shape both providers accept. */
async function flowWithAnthropic(screens: FlowScreen[]): Promise<FlowCritiqueResult> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic();
  const model = process.env.FRAMESMITH_LLM_ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';
  const content: Array<{ type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: 'image/png'; data: string } }> = [];
  for (const s of screens) {
    content.push({ type: 'text', text: `Screen: ${s.name}` });
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: s.png } });
  }
  content.push({ type: 'text', text: 'Evaluate this flow against the rubric. Return the JSON object only.' });
  const response = await client.messages.create({
    model,
    max_tokens: 1500,
    system: FLOW_SYSTEM_PROMPT,
    messages: [{ role: 'user', content }],
  });
  const text = response.content
    .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('');
  return { provider: 'anthropic', model, ...parseFlowRubric(text, screens.map((s) => s.name)) };
}

async function flowWithOpenAI(screens: FlowScreen[]): Promise<FlowCritiqueResult> {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI();
  const model = process.env.FRAMESMITH_LLM_OPENAI_MODEL ?? 'gpt-4.1';
  const content: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [];
  for (const s of screens) {
    content.push({ type: 'text', text: `Screen: ${s.name}` });
    content.push({ type: 'image_url', image_url: { url: `data:image/png;base64,${s.png}` } });
  }
  content.push({ type: 'text', text: 'Evaluate this flow against the rubric. Return the JSON object only.' });
  const response = await client.chat.completions.create({
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: FLOW_SYSTEM_PROMPT },
      { role: 'user', content },
    ],
  });
  const text = response.choices[0]?.message?.content ?? '';
  return { provider: 'openai', model, ...parseFlowRubric(text, screens.map((s) => s.name)) };
}

export const flowJudges: Record<Provider, FlowJudge> = {
  anthropic: flowWithAnthropic,
  openai: flowWithOpenAI,
};

export async function judgeFlow(screens: FlowScreen[], opts: { provider?: Provider } = {}): Promise<FlowCritiqueResult> {
  if (screens.length < 2) throw new Error('judgeFlow needs at least 2 screens — flow qualities do not exist on one.');
  const provider = opts.provider ?? pickProvider();
  if (!provider) {
    throw new LLMJudgeUnavailableError(
      'No LLM provider configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY (or FRAMESMITH_LLM_PROVIDER=anthropic|openai to pick one explicitly).',
    );
  }
  return flowJudges[provider](screens);
}
