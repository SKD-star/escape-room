/**
 * AIClient — client-side AI facade. Talks to the server AI endpoints and
 * mirrors the server's procedural fallback locally so puzzles, hints and
 * dialogue work even with no backend at all.
 */
import { api } from '../net/ApiClient.js';
import { AI_APP_TITLE, AI_BASE_URL, AI_KEY, AI_MODELS } from './aiConfig.js';

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

const ROOM_PUZZLES = {
  haunted_library: {
    type: 'keypad',
    title: 'The Librarian\'s Mechanism',
    narrative: 'A heavy brass keypad seals the exit lectern. Observe and count the physical relics in the library to deduce the code.',
    code: '1462',
    clue: 'Observe the library relics from center to exit door:\nI. Reading Lecterns in the center\nII. Ancestral Wall Paintings in the gallery\nIII. Lit Candles placed around the room\nIV. Stone Pillars framing the exit door\n\nCount each physical relic group in order to reveal the four-digit lock code.',
  },
  library: {
    type: 'keypad',
    title: 'The Librarian\'s Mechanism',
    narrative: 'A heavy brass keypad seals the exit lectern. Observe and count the physical relics in the library to deduce the code.',
    code: '1462',
    clue: 'Observe the library relics from center to exit door:\nI. Reading Lecterns in the center\nII. Ancestral Wall Paintings in the gallery\nIII. Lit Candles placed around the room\nIV. Stone Pillars framing the exit door\n\nCount each physical relic group in order to reveal the four-digit lock code.',
  },
  ancient_temple: {
    type: 'sequence',
    title: 'The Sacred Ritual Altar',
    narrative: 'Ancient symbols burn upon the stone altar. Select the 4 marks in the order of the temple ritual.',
    sequence: ['serpent', 'flame', 'moon', 'skull'],
    clue: 'The Ritual of Shadows:\nI. The slithering creature beneath the grass\nII. The sacred fire that consumes all darkness\nIII. The glowing celestial orb of midnight\nIV. The silent remains of the fallen\n\nTouch the altar symbols in the exact order of the shadow ritual.',
  },
  temple: {
    type: 'sequence',
    title: 'The Sacred Ritual Altar',
    narrative: 'Ancient symbols burn upon the stone altar. Select the 4 marks in the order of the temple ritual.',
    sequence: ['serpent', 'flame', 'moon', 'skull'],
    clue: 'The Ritual of Shadows:\nI. The slithering creature beneath the grass\nII. The sacred fire that consumes all darkness\nIII. The glowing celestial orb of midnight\nIV. The silent remains of the fallen\n\nTouch the altar symbols in the exact order of the shadow ritual.',
  },
  forgotten_prison: {
    type: 'keypad',
    title: 'Warden\'s Security Keypad',
    narrative: 'A rusty iron keypad guards the cell block exit. Count the physical prison fixtures to form the code.',
    code: '4421',
    clue: 'Warden\'s Cell Block Log:\nI. Barred Prison Cells along the north wall\nII. Heavy Chains hanging from the ceiling\nIII. Interrogation Tables & Chairs\nIV. Reinforced Steel Exit Door\n\nTotal up each physical feature in sequence to form the warden\'s keypad code.',
  },
  prison: {
    type: 'keypad',
    title: 'Warden\'s Security Keypad',
    narrative: 'A rusty iron keypad guards the cell block exit. Count the physical prison fixtures to form the code.',
    code: '4421',
    clue: 'Warden\'s Cell Block Log:\nI. Barred Prison Cells along the north wall\nII. Heavy Chains hanging from the ceiling\nIII. Interrogation Tables & Chairs\nIV. Reinforced Steel Exit Door\n\nTotal up each physical feature in sequence to form the warden\'s keypad code.',
  },
  abandoned_lab: {
    type: 'keypad',
    title: 'Laboratory Mainframe Lock',
    narrative: 'The terminal screen flashes green. Input the laboratory physical inventory counts in sequence.',
    code: '4231',
    clue: 'Research Lab Protocol:\nI. Glowing Specimen Fluid Tanks\nII. Heavy Steel Lab Benches\nIII. Glass Chemical Beakers\nIV. Fluorescent Light Fixtures\n\nCount the items in the lab in this order to reveal the override passcode.',
  },
  laboratory: {
    type: 'keypad',
    title: 'Laboratory Mainframe Lock',
    narrative: 'The terminal screen flashes green. Input the laboratory physical inventory counts in sequence.',
    code: '4231',
    clue: 'Research Lab Protocol:\nI. Glowing Specimen Fluid Tanks\nII. Heavy Steel Lab Benches\nIII. Glass Chemical Beakers\nIV. Fluorescent Light Fixtures\n\nCount the items in the lab in this order to reveal the override passcode.',
  },
  abandoned_hospital: {
    type: 'sequence',
    title: 'East Ward Diagnostic Lock',
    narrative: 'The morgue control panel requires entering a 5-step diagnostic symbol sequence.',
    sequence: ['eye', 'hourglass', 'cross', 'skull', 'moon'],
    clue: 'East Ward Patient Protocol:\nI. The All-Seeing gaze watching the patients\nII. The Sands of Time slipping away\nIII. The Healing Cross of redemption\nIV. The Final Marker of mortality\nV. The Pale Crescent of the night shift\n\nPress the 5 diagnostic panel symbols in ritual order.',
  },
  hospital: {
    type: 'sequence',
    title: 'East Ward Diagnostic Lock',
    narrative: 'The morgue control panel requires entering a 5-step diagnostic symbol sequence.',
    sequence: ['eye', 'hourglass', 'cross', 'skull', 'moon'],
    clue: 'East Ward Patient Protocol:\nI. The All-Seeing gaze watching the patients\nII. The Sands of Time slipping away\nIII. The Healing Cross of redemption\nIV. The Final Marker of mortality\nV. The Pale Crescent of the night shift\n\nPress the 5 diagnostic panel symbols in ritual order.',
  },
  haunted_mansion: {
    type: 'keypad',
    title: 'Grandfather Clock Lock',
    narrative: 'The stopped clock face hides a 5-digit keypad lock. Count the manor relics to start the pendulum.',
    code: '52614',
    clue: 'The Heir\'s Cipher:\nI. Ancestral Portraits in gallery\nII. Dining Chairs set at the table\nIII. Flames flickering on grand chandelier\nIV. Stopped Grandfather Clock\nV. Decorative Wall Mirrors\n\nCount each relic in the manor to assemble the 5-digit clock key.',
  },
  mansion: {
    type: 'keypad',
    title: 'Grandfather Clock Lock',
    narrative: 'The stopped clock face hides a 5-digit keypad lock. Count the manor relics to start the pendulum.',
    code: '52614',
    clue: 'The Heir\'s Cipher:\nI. Ancestral Portraits in gallery\nII. Dining Chairs set at the table\nIII. Flames flickering on grand chandelier\nIV. Stopped Grandfather Clock\nV. Decorative Wall Mirrors\n\nCount each relic in the manor to assemble the 5-digit clock key.',
  },
  medieval_castle: {
    type: 'sequence',
    title: 'Royal Crest Mechanism',
    narrative: 'The ancient crest upon the round table requires a 5-step royal oath sequence.',
    sequence: ['shield', 'key', 'serpent', 'star', 'circle'],
    clue: 'The Royal Oath of Chivalry:\nI. The Knight\'s Iron Shield of defense\nII. The Golden Key of the realm\nIII. The Serpent Crest of the royal house\nIV. The Guiding Star of the north sky\nV. The Sovereign Circle of the round table\n\nSelect the crest marks in the exact order of the oath.',
  },
  castle: {
    type: 'sequence',
    title: 'Royal Crest Mechanism',
    narrative: 'The ancient crest upon the round table requires a 5-step royal oath sequence.',
    sequence: ['shield', 'key', 'serpent', 'star', 'circle'],
    clue: 'The Royal Oath of Chivalry:\nI. The Knight\'s Iron Shield of defense\nII. The Golden Key of the realm\nIII. The Serpent Crest of the royal house\nIV. The Guiding Star of the north sky\nV. The Sovereign Circle of the round table\n\nSelect the crest marks in the exact order of the oath.',
  },
  secret_bunker: {
    type: 'keypad',
    title: 'Radio Frequency Lock',
    narrative: 'The radio console array requires entering a 5-digit military equipment code.',
    code: '23415',
    clue: 'Quartermaster\'s Supply Ledger:\nI. Metal Bunk Bed Frames\nII. Wooden Supply Crates in corner\nIII. Wire-Caged Ceiling Lights\nIV. Master Radio Transceiver Console\nV. Steel Bulkhead Wall Panels\n\nCount the bunker equipment in order to calibrate the 5-digit frequency code.',
  },
  bunker: {
    type: 'keypad',
    title: 'Radio Frequency Lock',
    narrative: 'The radio console array requires entering a 5-digit military equipment code.',
    code: '23415',
    clue: 'Quartermaster\'s Supply Ledger:\nI. Metal Bunk Bed Frames\nII. Wooden Supply Crates in corner\nIII. Wire-Caged Ceiling Lights\nIV. Master Radio Transceiver Console\nV. Steel Bulkhead Wall Panels\n\nCount the bunker equipment in order to calibrate the 5-digit frequency code.',
  },
  cyber_facility: {
    type: 'sequence',
    title: 'Mainframe AI Core Boot',
    narrative: 'Interface deck requesting a complex 6-step neural sequence override to unlock the facility.',
    sequence: ['omega', 'infinity', 'eye', 'rune', 'wave', 'spiral'],
    clue: 'Control Room Syslog Boot Sequence:\nI. The Terminal Protocol of Finality\nII. The Endless Recursion Infinity Loop\nIII. The All-Seeing Optical Core Sensor\nIV. The Ancient Machine Cipher Rune\nV. The Quantum Data Stream Wave\nVI. The Neural Core Matrix Spiral\n\nExecute the neural core sequence in this 6-step order.',
  },
  cyber: {
    type: 'sequence',
    title: 'Mainframe AI Core Boot',
    narrative: 'Interface deck requesting a complex 6-step neural sequence override to unlock the facility.',
    sequence: ['omega', 'infinity', 'eye', 'rune', 'wave', 'spiral'],
    clue: 'Control Room Syslog Boot Sequence:\nI. The Terminal Protocol of Finality\nII. The Endless Recursion Infinity Loop\nIII. The All-Seeing Optical Core Sensor\nIV. The Ancient Machine Cipher Rune\nV. The Quantum Data Stream Wave\nVI. The Neural Core Matrix Spiral\n\nExecute the neural core sequence in this 6-step order.',
  },
  boss_room: {
    type: 'riddle',
    title: 'The Final Convergence',
    narrative: 'The floating eye entity gazes into your mind: "Ten rooms cleared. What did you seek in every single room?"',
    riddle: 'Ten rooms were built to test your spirit. Ten doors surround you. What were you seeking in every single room?',
    answer: 'freedom',
    clue: 'The First Page (written in your own hand):\n"You were never trapped by walls, but by your own mind. In every library, temple, prison, and vault, you sought the one thing no lock can hold."\n\nSolve the riddle: What is sought by every captive soul?',
  },
  boss: {
    type: 'riddle',
    title: 'The Final Convergence',
    narrative: 'The floating eye entity gazes into your mind: "Ten rooms cleared. What did you seek in every single room?"',
    riddle: 'Ten rooms were built to test your spirit. Ten doors surround you. What were you seeking in every single room?',
    answer: 'freedom',
    clue: 'The First Page (written in your own hand):\n"You were never trapped by walls, but by your own mind. In every library, temple, prison, and vault, you sought the one thing no lock can hold."\n\nSolve the riddle: What is sought by every captive soul?',
  },
};

function localPuzzle(theme, difficulty) {
  const match = ROOM_PUZZLES[theme] || ROOM_PUZZLES.haunted_library;
  return {
    ...match,
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
    if (puzzle.type === 'riddle') {
      if (tier === 0) return 'Read the note or inscription logged in your Journal [J]. Think of what a prisoner wants most.';
      if (tier >= 1) return 'Consider the core theme of the game: escaping captivity to obtain what?';
    }
    if (puzzle.type === 'keypad') {
      if (tier === 0) return 'Read the room note carefully. It names physical objects in a specific top-to-bottom order.';
      if (tier >= 1) return 'Explore the room and count each group of objects mentioned in the note from left to right or center to door.';
    }
    if (puzzle.type === 'sequence') {
      if (tier === 0) return 'Look at the ritual lines in your Journal [J]. Each line describes one symbol metaphorically.';
      if (tier >= 1) return 'Match each line description (e.g. creature = serpent, fire = flame, sky = moon) in order.';
    }
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

  /**
   * Full chatbot turn for the room spirit.
   *
   * Three tiers, in order: the game server (which holds the .env key), a
   * direct browser call on the built-in free key (so the static Netlify build
   * talks to a real model too), then the offline engine below. The player is
   * never asked for a key — the free one is always there.
   *
   * @returns {Promise<{line: string, mood?: string, suggestions?: string[], provider: string}>}
   */
  async getDialogue(npc, theme, message, history = [], context = {}) {
    const res = await api.aiDialogue({ npc, theme, message, history, context });
    if (res.ok && res.data?.line && res.data.provider !== 'fallback') {
      return { ...res.data, provider: res.data.provider || 'server' };
    }

    const direct = await directDialogue(npc, theme, message, history, context);
    if (direct) return direct;

    // The server's own procedural answer still beats ours if we got one.
    if (res.ok && res.data?.line) return { ...res.data, provider: 'fallback' };
    return localDialogue(npc, theme, message, history, context);
  },
};

// ---------------------------------------------------------------------------
// Tier 2 — direct browser → OpenRouter free models, on the key baked into the
// build. Runs whenever the backend is unreachable or keyless (static hosting),
// which is the normal case for the deployed game.
// ---------------------------------------------------------------------------

const MOODS = new Set(['calm', 'ominous', 'helpful', 'amused']);

async function directDialogue(npc, theme, message, history, context) {
  if (!AI_KEY) return null;
  const system =
    `You are '${npc}', the resident spirit and guide of the ${String(theme).replace(/_/g, ' ')} ` +
    'in a horror escape-room game. You are a full conversational companion, not a menu of canned ' +
    'lines: the player types freely and you answer them directly.\n' +
    'Answer the actual question first, using the LIVE ROOM STATE below, and never repeat a ' +
    'sentence you have already used. You may discuss the room, its objects and lore, the ' +
    'mechanism, the notes, carried items, the presence that hunts them, the flashlight and sanity, ' +
    'and your own history; questions about the real world get turned back to the room in character. ' +
    'Be genuinely useful but make them work: point them at what to observe, narrow it if they are ' +
    'still stuck, and if they plainly demand the answer give only the first element and tell them ' +
    'to earn the rest — never write the full solution verbatim. Hushed, archaic, faintly ' +
    'threatening, 2-4 sentences, no emoji or markdown. Always write in English, including ' +
    'the suggestions.\n\n' +
    `LIVE ROOM STATE:\n${describeContext(theme, context)}\n\n` +
    'Reply with NOTHING but a single JSON object — no prose, no code fence: ' +
    '{"line": str, "mood": "calm"|"ominous"|"helpful"|"amused", ' +
    '"suggestions": [2-3 follow-up questions, each under 6 words]}.';

  const messages = [{ role: 'system', content: system }];
  for (const h of (history || []).slice(-16)) {
    messages.push({
      role: h.role === 'assistant' ? 'assistant' : 'user',
      content: String(h.content ?? '').slice(0, 600),
    });
  }
  messages.push({ role: 'user', content: String(message).slice(0, 600) });

  // Walk the model chain: a delisted or rate-limited free model hands off to
  // the next one rather than dropping the player back to the offline voice.
  for (const model of AI_MODELS) {
    try {
      const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${AI_KEY}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': AI_APP_TITLE,
        },
        body: JSON.stringify({
          model,
          // 700, not 420: the free reasoning models burn a chunk of the budget
          // thinking, and a truncated reply is unparseable JSON.
          max_tokens: 700,
          temperature: 0.85,
          presence_penalty: 0.5,
          frequency_penalty: 0.35,
          messages,
        }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const parsed = parseModelJson(data.choices?.[0]?.message?.content);
      if (!parsed?.line) continue;
      return {
        line: String(parsed.line),
        // Free models write prose here ("eerie and mysterious"); the UI only
        // understands the four moods it asked for.
        mood: MOODS.has(parsed.mood) ? parsed.mood : 'calm',
        suggestions: Array.isArray(parsed.suggestions)
          ? parsed.suggestions.slice(0, 3).map((s) => String(s).slice(0, 48))
          : [],
        provider: 'openrouter',
        model,
      };
    } catch {
      // Network hiccup on this model — try the next.
    }
  }
  return null;
}

/**
 * Parse a reply that is *supposed* to be JSON. Free models routinely ignore
 * the instruction and wrap the object in a ```json fence or a <think> block,
 * so peel those off before giving up on an otherwise good answer.
 */
function parseModelJson(content) {
  let text = String(content || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();
  try {
    return JSON.parse(text);
  } catch {
    const braced = text.match(/\{[\s\S]*\}/);
    if (!braced) return null;
    try {
      return JSON.parse(braced[0]);
    } catch {
      return null;
    }
  }
}

/** Flatten the live room state into the briefing both AI tiers read. */
function describeContext(theme, context = {}) {
  const ctx = context || {};
  const lines = [`Room theme: ${theme}.`];
  if (ctx.room_name) lines.push(`Room name: ${ctx.room_name} (chapter ${ctx.chapter ?? '?'}).`);
  if (ctx.objective) lines.push(`Player's current objective: ${ctx.objective}`);

  const p = ctx.puzzle || {};
  if (p.type) {
    lines.push(`Room mechanism: a ${p.type} titled '${p.title || 'the mechanism'}'.`);
    if (p.clue) lines.push(`The clue the player already has: ${String(p.clue).slice(0, 600)}`);
    if (p.riddle) lines.push(`The riddle inscribed: ${String(p.riddle).slice(0, 300)}`);
    if (p.solution) lines.push(`SECRET SOLUTION (never state it verbatim): ${String(p.solution).slice(0, 120)}`);
    lines.push(`Mechanism solved already: ${p.solved ? 'yes' : 'no'}.`);
  }
  lines.push(ctx.inventory?.length
    ? `Player is carrying: ${ctx.inventory.slice(0, 12).join(', ')}.`
    : 'Player is carrying nothing yet.');
  if (ctx.needed_key) lines.push(`The exit door still needs: ${ctx.needed_key}.`);
  if (ctx.landmarks?.length) lines.push(`Notable things in this room: ${ctx.landmarks.slice(0, 14).join(', ')}.`);

  const status = [];
  if (ctx.sanity != null) status.push(`sanity ${Math.round(ctx.sanity * 100)}%`);
  if (ctx.battery != null) {
    status.push(`flashlight battery ${Math.round(ctx.battery * 100)}% (${ctx.flashlight_on ? 'on' : 'off'})`);
  }
  if (ctx.time_in_room_s != null) status.push(`${Math.round(ctx.time_in_room_s)}s spent in this room`);
  if (ctx.failed_attempts) status.push(`${ctx.failed_attempts} failed mechanism attempts`);
  if (ctx.hints_used) status.push(`${ctx.hints_used} hints spent`);
  if (status.length) lines.push(`Player status: ${status.join(', ')}.`);
  if (ctx.difficulty) lines.push(`Difficulty mode: ${ctx.difficulty}.`);
  if (ctx.rooms_cleared != null) lines.push(`Rooms cleared so far: ${ctx.rooms_cleared} of 10.`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Tier 3 — offline conversation engine. Not a canned-line table: it reads the
// same live room state, remembers what it has already said, and escalates its
// guidance the harder the player pushes.
// ---------------------------------------------------------------------------

const TOPIC_WORDS = {
  mechanism: ['code', 'number', 'digit', 'keypad', 'lock', 'combination', 'password', 'sequence',
    'symbol', 'order', 'ritual', 'riddle', 'answer', 'solve', 'puzzle', 'mechanism', 'panel'],
  exit: ['door', 'exit', 'escape', 'leave', 'key', 'unlock', 'gate', 'open'],
  items: ['item', 'carry', 'inventory', 'holding', 'pick', 'collected', 'bag'],
  search: ['where', 'look', 'search', 'find', 'hidden', 'secret', 'behind', 'under'],
  self: ['who are you', 'your name', 'ghost', 'spirit', 'librarian', 'keeper', 'dead', 'alive'],
  survival: ['dark', 'sanity', 'light', 'flashlight', 'torch', 'battery', 'presence', 'haunt',
    'monster', 'afraid', 'scared', 'timer', 'following', 'watching', 'chasing', 'alone', 'safe'],
  lore: ['story', 'history', 'happened', 'lore', 'before', 'past', 'built', 'why'],
  stuck: ['stuck', 'help', 'hint', 'clue', 'nudge', 'lost', 'confused', 'no idea'],
};

const PRESSURE_WORDS = ['just tell', 'tell me the', 'give me the', 'what is the code',
  'what is the answer', 'spoil', 'i give up', 'straight answer'];

function topicOf(msg) {
  let best = 'open';
  let bestHits = 0;
  for (const [topic, words] of Object.entries(TOPIC_WORDS)) {
    const hits = words.reduce((n, w) => n + (msg.includes(w) ? 1 : 0), 0);
    if (hits > bestHits) { bestHits = hits; best = topic; }
  }
  return best;
}

function localDialogue(npc, theme, message, history = [], context = {}) {
  const msg = String(message || '').toLowerCase();
  const place = String(theme).replace(/_/g, ' ');
  const ctx = context || {};
  const p = ctx.puzzle || {};
  const clue = String(p.clue || '').trim();
  const solution = String(p.solution || '').trim();
  const asks = history.filter((h) => h.role === 'user').length;
  const demanding = PRESSURE_WORDS.some((w) => msg.includes(w));
  // Each renewed demand buys one more element — never the whole answer.
  const demands = 1 + history.filter(
    (h) => h.role === 'user' && PRESSURE_WORDS.some((w) => String(h.content).toLowerCase().includes(w)),
  ).length;
  const said = new Set(history.filter((h) => h.role === 'assistant').map((h) => h.content));
  const topic = topicOf(msg);

  /** The first `count` elements of the solution, capped below the full answer. */
  const revealed = (count) => {
    if (!solution) return '';
    let parts = solution.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
    if (parts.length === 1) parts = [...solution];
    const keep = Math.max(1, Math.min(count, parts.length - 1));
    return parts.slice(0, keep).join(' ');
  };

  let line;
  let mood = 'helpful';

  if (topic === 'mechanism' || topic === 'stuck') {
    const head = revealed(demands);
    if (demanding && head) {
      const rest = demands < 2 ? 'The rest' : 'What still follows';
      line = `You would have it handed to you? Then take this much and no more: it begins with '${head}'. ${rest} you will earn from the ${place} itself.`;
      mood = 'ominous';
    } else if (asks >= 3 && clue) {
      line = `Then stop reading and start counting. ${clue.replace(/\n/g, ' ').slice(0, 220)} Take them strictly in the order they are named.`;
    } else if (clue) {
      line = `The ${place} already told you how. Recall the inscription: "${clue.split('\n')[0].slice(0, 140)}" — every line of it names something you can touch.`;
    } else {
      line = `The mechanism answers to the ${place}, not to me. Walk it slowly and count what repeats — the room never places a thing twice by accident.`;
    }
  } else if (topic === 'exit') {
    line = ctx.needed_key
      ? `The door will not part for empty hands. It wants the ${String(ctx.needed_key).replace(/_/g, ' ')} — search where the room hides its shame: behind, beneath, above.`
      : 'You hold what the door asked for. Feed the mechanism its answer and the way out will remember it was ever a door.';
  } else if (topic === 'items') {
    line = ctx.inventory?.length
      ? `You carry ${ctx.inventory.join(', ')}. Each of those was left for a reason — turn them over.`
      : 'You carry nothing yet. Empty hands open nothing here; search the corners first.';
    mood = 'calm';
  } else if (topic === 'search') {
    line = ctx.landmarks?.length
      ? `Look to ${ctx.landmarks.slice(0, 3).join(', ')} — the room keeps its secrets in plain arrangement.`
      : `Search the edges of the ${place}. What is hidden is always beside what is obvious.`;
  } else if (topic === 'self') {
    line = `I am ${npc}. I stayed when the rest were carried out, and I have watched every visitor since decide the ${place} was smarter than they were. So far, they were right.`;
    mood = 'calm';
  } else if (topic === 'survival') {
    line = (ctx.battery != null && ctx.battery < 0.3)
      ? 'Your light is nearly spent — I can hear it thinning. Burn it only where you must look; the dark takes your reason faster than it takes your body.'
      : 'Keep the beam lit while you search. Light steadies the mind, and what walks these halls dislikes being seen almost as much as it dislikes being ignored.';
    mood = 'ominous';
  } else if (topic === 'lore') {
    line = `This ${place} was not built to hold you. It was built to ask something, and it has been asking a long time. You are simply the first in a while to answer.`;
    mood = 'calm';
  } else {
    const subject = String(message || '').trim().replace(/\?+$/, '').slice(0, 60) || 'your question';
    line = `"${subject}" — the ${place} has an answer for that, though it will not say it plainly. Tell me what you have already searched and I will tell you what you have missed.`;
    mood = 'calm';
  }

  if (said.has(line)) {
    line = `I have said my piece on that. Ask me something the ${place} has not already answered — what have you touched since we last spoke?`;
    mood = 'amused';
  }

  let suggestions = ['What should I count?', 'Where is the key?', 'Who were you?'];
  if (topic === 'mechanism') suggestions = ['I am still stuck.', 'Which objects exactly?', 'What is this place?'];
  else if (topic === 'exit') suggestions = ['Where is it hidden?', 'What opens the lock?', 'Is something following me?'];

  return { line, mood, suggestions, provider: 'offline' };
}
