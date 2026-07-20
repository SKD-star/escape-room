/**
 * AIClient — client-side AI facade. Talks to the server AI endpoints and
 * mirrors the server's procedural fallback locally so puzzles, hints and
 * dialogue work even with no backend at all.
 */
import { api } from '../net/ApiClient.js';

const LOCAL_RIDDLES = [
  { riddle: 'I have keys but open no locks. I have space but no room. You can enter, but you can\'t go outside.', answer: 'keyboard' },
  { riddle: 'The more you take from me, the bigger I become. What am I?', answer: 'hole' },
  { riddle: 'I speak without a mouth and hear without ears. I am born in air. What am I?', answer: 'echo' },
  { riddle: 'I am not alive, but I grow. I don\'t have lungs, but I need air. Water kills me.', answer: 'fire' },
  { riddle: 'I follow you all day in the light, but vanish when darkness falls. What am I?', answer: 'shadow' },
  { riddle: 'I have cities but no houses, forests but no trees, and water but no fish.', answer: 'map' },
  { riddle: 'What can travel around the world while staying in a corner?', answer: 'stamp' },
  { riddle: 'I am always in front of you but can never be seen. What am I?', answer: 'future' },
];

const SYMBOLS = ['moon', 'eye', 'serpent', 'key', 'skull', 'flame', 'hourglass', 'raven'];

function localPuzzle(theme, difficulty) {
  const kinds = ['keypad', 'riddle', 'sequence'];
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  if (kind === 'keypad') {
    const digits = 3 + Math.floor(difficulty * 3);
    let code = '';
    for (let i = 0; i < digits; i++) code += Math.floor(Math.random() * 10);
    return {
      type: 'keypad',
      title: 'The Sealed Mechanism',
      narrative: 'A cold keypad waits. Someone scratched tally marks beside it — then stopped mid-stroke.',
      code,
      clue: `${digits} digits. The room shows them to those who look at what burns.`,
      difficulty,
      provider: 'local',
    };
  }
  if (kind === 'riddle') {
    const r = LOCAL_RIDDLES[Math.floor(Math.random() * LOCAL_RIDDLES.length)];
    return {
      type: 'riddle',
      title: 'A Voice in the Dark',
      narrative: 'Words scrape themselves into the surface as you watch…',
      riddle: r.riddle,
      answer: r.answer,
      difficulty,
      provider: 'local',
    };
  }
  const length = Math.min(SYMBOLS.length, 4 + Math.floor(difficulty * 3));
  const sequence = [...SYMBOLS].sort(() => Math.random() - 0.5).slice(0, length);
  return {
    type: 'sequence',
    title: 'The Order of Things',
    narrative: 'Old symbols shimmer faintly, remembering an order they once held.',
    sequence,
    clue: `The ${sequence[0]} leads. ${length} marks in total.`,
    difficulty,
    provider: 'local',
  };
}

const LOCAL_HINTS = [
  'Something in this room does not belong. Start there.',
  'Compare what you have collected with what the room keeps showing you.',
  'Stop searching the shadows — the answer is in plain sight, lit for you.',
];

export const aiClient = {
  /** @returns {Promise<object>} always resolves to a valid puzzle object */
  async getPuzzle(theme, roomId, difficulty = 0.5, context = '') {
    const res = await api.aiPuzzle({ theme, room_id: roomId, base_difficulty: difficulty, context });
    if (res.ok && res.data?.type) return res.data;
    return localPuzzle(theme, difficulty);
  },

  /** @returns {Promise<string>} hint text */
  async getHint(puzzle, tier) {
    const res = await api.aiHint({ puzzle, tier });
    if (res.ok && res.data?.hint) return res.data.hint;
    if (puzzle.type === 'riddle' && tier >= 2 && puzzle.answer) {
      return `The answer begins with "${puzzle.answer[0].toUpperCase()}" and has ${puzzle.answer.length} letters.`;
    }
    if (puzzle.clue && tier >= 1) return puzzle.clue;
    return LOCAL_HINTS[Math.min(tier, LOCAL_HINTS.length - 1)];
  },

  /** @returns {Promise<{text: string}>} story beat */
  async getStory(theme, progress) {
    const res = await api.aiStory({ theme, progress });
    if (res.ok && res.data?.text) return res.data;
    return {
      text: 'The door seals behind you. The air here is older, and it notices you breathing it.',
    };
  },
};
