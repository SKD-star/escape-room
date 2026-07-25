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

const DIGIT_RIDDLES = [
  'The Unbroken Void',
  'The Solitary Lectern',
  'The Twin Pillars',
  'The Trio of Torches',
  'The Four Vault Corners',
  'The Five-Pointed Star',
  'The Six Hexagon Seals',
  'The Seven Heavenly Rays',
  'The Infinite Hourglass',
  'The Nine Sacred Runes',
];

function localPuzzle(theme, difficulty) {
  if (theme === 'library' || theme === 'haunted_library') {
    return {
      type: 'keypad',
      title: 'The Librarian\'s Mechanism',
      narrative: 'A brass keypad waits. The inscription on the third bookshelf guides your deduction.',
      code: '1462',
      clue: 'Observe the room\'s physical features in order:\nI. Reading Lecterns in the center\nII. Paintings hanging on the walls\nIII. Candles lit around the room\nIV. Stone Pillars framing the exit door',
      difficulty,
      provider: 'local',
    };
  }

  const kinds = ['keypad', 'riddle', 'sequence'];
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  if (kind === 'keypad') {
    return {
      type: 'keypad',
      title: 'The Sealed Mechanism',
      narrative: 'A cold keypad waits. Count the room\'s physical relics in sequence to solve.',
      code: '1462',
      clue: 'Observe the room\'s physical features in order:\nI. Reading Lecterns in the center\nII. Paintings hanging on the walls\nIII. Candles lit around the room\nIV. Stone Pillars framing the exit door',
      difficulty,
      provider: 'local',
    };
  }
  if (kind === 'riddle') {
    const r = LOCAL_RIDDLES[Math.floor(Math.random() * LOCAL_RIDDLES.length)];
    return {
      type: 'riddle',
      title: 'A Voice in the Dark',
      narrative: 'Words scrape themselves into the stone as you watch…',
      riddle: r.riddle,
      answer: r.answer,
      clue: `An ancient scroll poses a riddle: "${r.riddle}" Solve the riddle to unlock the mechanism.`,
      difficulty,
      provider: 'local',
    };
  }
  const length = Math.min(SYMBOLS.length, 4);
  const sequence = [...SYMBOLS].sort(() => Math.random() - 0.5).slice(0, length);
  const formattedNames = sequence.map((s) => s.charAt(0).toUpperCase() + s.slice(1));
  const poem = `1. First ${formattedNames[0]} ascends,\n2. Then ${formattedNames[1]} awakens,\n3. Followed by ${formattedNames[2]},\n4. And ending with ${formattedNames[3] || 'the Altar'}.`;

  return {
    type: 'sequence',
    title: 'The Order of Things',
    narrative: 'Old symbols shimmer faintly, remembering the sacred order etched in stone.',
    sequence,
    clue: `The ritual poem reveals the sequence order:\n${poem}`,
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
