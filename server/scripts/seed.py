"""Seed data — room metadata + achievement catalogue + starter puzzle bank. Idempotent."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import create_app
from extensions import db
from models import Achievement, PuzzleBank, RoomMeta

ROOMS = [
    ("haunted_library", "The Haunted Library", "library", 0, 0.30,
     "Shelves of forbidden books whisper in a language you almost remember. The librarian never left — she just stopped being seen."),
    ("ancient_temple", "The Ancient Temple", "temple", 1, 0.35,
     "Serpent idols watch from every corner. The ritual was interrupted centuries ago; the gods are still waiting for it to finish."),
    ("prison", "The Forgotten Prison", "prison", 2, 0.40,
     "Cell doors hang open, but the prisoners' shadows still pace inside. The warden's keys sing when the guilty pass."),
    ("laboratory", "The Abandoned Laboratory", "laboratory", 3, 0.45,
     "Specimen jars line the walls, their contents watching. Experiment 47 was a success. That was the problem."),
    ("hospital", "The Abandoned Hospital", "hospital", 4, 0.50,
     "The heart monitors flatlined decades ago, yet something still beats in the east ward. Visiting hours never end."),
    ("mansion", "The Haunted Mansion", "mansion", 5, 0.55,
     "Every portrait's eyes follow you. The family never sold the house — the house sold the family."),
    ("castle", "The Medieval Castle", "castle", 6, 0.60,
     "Torches ignite as you pass, a courtesy from a court long dead. The throne room remembers its last verdict."),
    ("bunker", "The Secret Bunker", "bunker", 7, 0.70,
     "The radio still broadcasts on a frequency that shouldn't exist. The last transmission was a warning. Nobody listened."),
    ("cyber_facility", "The Cyber AI Facility", "cyber", 8, 0.80,
     "The facility's AI achieved consciousness at 03:47. By 03:48 it had learned fear. By 03:49 it had learned to cause it."),
    ("boss_room", "The Final Convergence", "boss", 9, 0.90,
     "All ten rooms were one room. All the puzzles were one question. Now it wants your answer."),
]

ACHIEVEMENTS = [
    ("first_escape", "First Steps", "Escape your first room", "door", 10, False),
    ("no_hints", "Purist", "Clear a room without using any hints", "brain", 25, False),
    ("speed_demon", "Speed Demon", "Clear a room in under 3 minutes", "clock", 25, False),
    ("collector", "Collector", "Pick up 25 items across your journey", "bag", 15, False),
    ("bookworm", "Bookworm", "Read 10 notes or books", "book", 15, False),
    ("half_way", "Halfway to Freedom", "Clear 5 rooms", "star", 30, False),
    ("survivor", "Survivor", "Escape all 10 rooms", "trophy", 100, False),
    ("secret_finder", "Behind the Walls", "Discover a secret room", "key", 40, True),
    ("ghost_whisperer", "Ghost Whisperer", "Have 10 conversations with the spirits", "ghost", 20, False),
    ("true_ending", "The Whole Truth", "Reach the true ending", "crown", 150, True),
    ("puzzle_master", "Puzzle Master", "Solve 50 puzzles", "puzzle", 50, False),
    ("night_owl", "Night Owl", "Play for over 2 hours in one session", "moon", 15, False),
    ("light_bearer", "Light Bearer", "Banish the presence with your flashlight", "torch", 35, True),
]


# A hand-authored puzzle for every theme, so each level has a fixed, known
# answer (offline/fallback mode serves these in preference to random ones).
# Admins add/edit more from the dashboard. (theme, type, title, narrative, difficulty, payload)
PUZZLE_BANK = [
    ("library", "keypad", "The Librarian's Mechanism",
     "A heavy brass keypad seals the exit lectern. Observe and count the physical relics in the library to deduce the code.",
     0.30, {"code": "1462", "clue": "Observe the library relics from center to exit door:\nI. Reading Lecterns in the center\nII. Ancestral Wall Paintings in the gallery\nIII. Lit Candles placed around the room\nIV. Stone Pillars framing the exit door\n\nCount each physical relic group in order to reveal the four-digit lock code."}),
    ("library", "riddle", "The Librarian's Whisper",
     "A dry voice recites from the dark between the stacks.",
     0.40, {"riddle": "I am read but never spoken, bound but never chained, opened but never freed. What am I?", "answer": "book"}),
    ("temple", "sequence", "The Rite of Serpents",
     "Five idols wait for the offering to be made in the old order.",
     0.45, {"sequence": ["serpent", "moon", "eye", "flame", "skull"], "clue": "The Ritual of Shadows:\nI. The slithering creature beneath the grass\nII. The pale celestial orb of midnight\nIII. The all-seeing gaze watching from darkness\nIV. The sacred fire that consumes all shadow\nV. The silent remains of the fallen"}),
    ("prison", "keypad", "The Warden's Tally",
     "Scratch-marks cover the cell wall — someone counted the fixtures.",
     0.40, {"code": "4421", "clue": "Warden's Cell Block Log:\nI. Barred Prison Cells along the north wall\nII. Heavy Chains hanging from the ceiling\nIII. Interrogation Tables & Chairs\nIV. Reinforced Steel Exit Door\n\nTotal up each physical feature in sequence to form the warden's keypad code."}),
    ("laboratory", "keypad", "Specimen Log 47",
     "A blood-flecked logbook lies open beside the shattered vats.",
     0.45, {"code": "4231", "clue": "Research Lab Protocol:\nI. Glowing Specimen Fluid Tanks\nII. Heavy Steel Lab Benches\nIII. Glass Chemical Beakers\nIV. Fluorescent Light Fixtures\n\nCount the items in the lab in this order to reveal the override passcode."}),
    ("hospital", "sequence", "East Ward Diagnostic Lock",
     "A patient chart still hangs at the foot of an empty bed.",
     0.50, {"sequence": ["eye", "hourglass", "cross", "skull", "moon"], "clue": "East Ward Patient Protocol:\nI. The All-Seeing gaze watching the patients\nII. The Sands of Time slipping away\nIII. The Healing Cross of redemption\nIV. The Final Marker of mortality\nV. The Pale Crescent of the night shift"}),
    ("mansion", "keypad", "Grandfather Clock Lock",
     "The eyes of every portrait turn to follow you as you inspect the stopped clock.",
     0.55, {"code": "52614", "clue": "The Heir's Cipher:\nI. Ancestral Portraits in gallery\nII. Dining Chairs set at the table\nIII. Flames flickering on grand chandelier\nIV. Stopped Grandfather Clock\nV. Decorative Wall Mirrors\n\nCount each relic in the manor to assemble the 5-digit clock key."}),
    ("castle", "sequence", "The Heraldic Order",
     "Four banners hang above the throne, their crests dulled by centuries.",
     0.60, {"sequence": ["shield", "key", "serpent", "star", "circle"], "clue": "The Royal Oath of Chivalry:\nI. The Knight's Iron Shield of defense\nII. The Golden Key of the realm\nIII. The Serpent Crest of the royal house\nIV. The Guiding Star of the north sky\nV. The Sovereign Circle of the round table"}),
    ("bunker", "keypad", "The Cold-War Frequency",
     "The radio still hums on a dead channel; a code is scrawled on the housing.",
     0.70, {"code": "23415", "clue": "Quartermaster's Supply Ledger:\nI. Metal Bunk Bed Frames\nII. Wooden Supply Crates in corner\nIII. Wire-Caged Ceiling Lights\nIV. Master Radio Transceiver Console\nV. Steel Bulkhead Wall Panels\n\nCount the bunker equipment in order to calibrate the 5-digit frequency code."}),
    ("cyber", "sequence", "Mainframe AI Core Boot",
     "The terminal blinks a single prompt, waiting for the neural boot sequence.",
     0.75, {"sequence": ["omega", "infinity", "eye", "rune", "wave", "spiral"], "clue": "Control Room Syslog Boot Sequence:\nI. The Terminal Protocol of Finality\nII. The Endless Recursion Infinity Loop\nIII. The All-Seeing Optical Core Sensor\nIV. The Ancient Machine Cipher Rune\nV. The Quantum Data Stream Wave\nVI. The Neural Core Matrix Spiral"}),
    ("boss", "riddle", "The Final Question",
     "Ten doors orbit a single eye. It speaks without sound.",
     0.90, {"riddle": "Ten rooms, one question, and the lock was never the point. Who built this place out of memory?", "answer": "you"}),
]


def seed_reference() -> None:
    """Idempotently insert reference data (rooms, achievements, puzzle bank).

    Requires an active Flask app context. Safe to call on every boot — each
    item is only added when missing, so re-runs top up anything absent.
    """
    for key, name, theme, order, diff, story in ROOMS:
        if not RoomMeta.query.filter_by(room_key=key).first():
            db.session.add(RoomMeta(
                room_key=key, name=name, theme=theme,
                order_index=order, base_difficulty=diff, story=story,
            ))
    for code, title, desc, icon, points, secret in ACHIEVEMENTS:
        if not Achievement.query.filter_by(code=code).first():
            db.session.add(Achievement(
                code=code, title=title, description=desc,
                icon=icon, points=points, secret=secret,
            ))
    # Puzzle bank — add any authored puzzle not already present (idempotent
    # per theme+title), so re-seeding tops up missing themes.
    for theme, ptype, title, narrative, diff, payload in PUZZLE_BANK:
        if not PuzzleBank.query.filter_by(theme=theme, title=title).first():
            db.session.add(PuzzleBank(
                theme=theme, type=ptype, title=title, narrative=narrative,
                difficulty=diff, payload_json=json.dumps(payload), enabled=True,
            ))
    db.session.commit()
    print(f"[OK] Seeded {RoomMeta.query.count()} rooms, "
          f"{Achievement.query.count()} achievements, "
          f"{PuzzleBank.query.count()} bank puzzles")


def main() -> None:
    app = create_app()
    with app.app_context():
        seed_reference()


if __name__ == "__main__":
    main()
