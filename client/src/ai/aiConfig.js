/**
 * AI credentials for the Librarian chatbot.
 *
 * The game ships as a static build (Netlify) with no backend of its own, so
 * the browser talks to the model directly, on an OpenRouter key restricted to
 * their $0 model pool — no card, no spend.
 *
 * The key is NOT hardcoded here: this repo is public, and scanners revoke
 * leaked keys within hours. Supply it at build time instead:
 *
 *   local dev — VITE_AI_KEY=sk-or-v1-… in .env at the repo root (gitignored)
 *   Netlify   — Site settings → Environment variables → VITE_AI_KEY
 *
 * Get a free key at https://openrouter.ai/keys (no card required).
 *
 * SECURITY NOTE: whatever you set IS compiled into the public JS bundle and is
 * readable by anyone who opens devtools — that is unavoidable without a
 * backend. Only ever use a free-tier, zero-spend key. With no key set, the
 * chatbot falls back to the offline conversation engine in AIClient.js.
 */

/** OpenAI-compatible endpoint. OpenRouter fronts every free model. */
export const AI_BASE_URL = import.meta.env?.VITE_AI_BASE_URL
  || 'https://openrouter.ai/api/v1';

/** Free-tier OpenRouter key. Empty → offline engine only. */
export const AI_KEY = import.meta.env?.VITE_AI_KEY || '';

/**
 * Free models, tried in order — measured against the live free tier: gpt-oss
 * is the most consistent at returning clean JSON, nemotron is close behind but
 * spends tokens thinking, and gemma's shared pool answers 429 most of the day
 * so it sits last among the named models.
 *
 * OpenRouter rotates its $0 roster every few weeks, so the final entry is
 * OpenRouter's own free router — it forwards to whatever zero-cost model is
 * live right now, keeping the chatbot alive after every named model above it
 * has been delisted.
 */
export const AI_MODELS = (import.meta.env?.VITE_AI_MODEL
  ? [import.meta.env.VITE_AI_MODEL]
  : [
    'openai/gpt-oss-20b:free',
    'nvidia/nemotron-3-nano-30b-a3b:free',
    'google/gemma-4-31b-it:free',
    'openrouter/free',
  ]);

/** Sent to OpenRouter for its public app rankings; both optional. */
export const AI_APP_TITLE = 'AI Powered Escape Room';
