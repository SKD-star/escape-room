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
};
