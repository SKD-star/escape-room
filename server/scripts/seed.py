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
    ("library", "keypad", "The Overdue Ledger",
     "The last entry in the ledger is smeared, but the due dates are legible.",
     0.30, {"code": "1847", "clue": "Four books, four years overdue. Read the years on the spines, oldest first: 1-8-4-7."}),
    ("library", "riddle", "The Librarian's Whisper",
     "A dry voice recites from the dark between the stacks.",
     0.40, {"riddle": "I am read but never spoken, bound but never chained, opened but never freed. What am I?", "answer": "book"}),
    ("temple", "sequence", "The Rite of Serpents",
     "Five idols wait for the offering to be made in the old order.",
     0.45, {"sequence": ["serpent", "moon", "eye", "flame", "skull"], "clue": "The serpent is roused first, as the carvings above the altar show."}),
    ("prison", "keypad", "The Warden's Tally",
     "Scratch-marks cover the cell wall — someone counted the days.",
     0.40, {"code": "0713", "clue": "Cell 07, the thirteenth stone from the door. Read it 0-7-1-3."}),
    ("laboratory", "keypad", "Specimen Log 47",
     "A blood-flecked logbook lies open beside the shattered tanks.",
     0.45, {"code": "0047", "clue": "Experiment 47 was the only success. Four digits: two zeros, then forty-seven."}),
    ("hospital", "keypad", "Ward Chart 3-47",
     "A patient chart still hangs at the foot of an empty bed.",
     0.50, {"code": "0347", "clue": "Room 3, bed 47 — and the heart monitor flatlined at 03:47."}),
    ("mansion", "riddle", "The Portrait's Question",
     "The eyes of every portrait turn to follow you as you read the plaque.",
     0.55, {"riddle": "I show you yourself yet keep no memory; I wear your face yet hold no history. What am I?", "answer": "mirror"}),
    ("castle", "sequence", "The Heraldic Order",
     "Four banners hang above the throne, their crests dulled by centuries.",
     0.60, {"sequence": ["key", "flame", "raven", "skull"], "clue": "The key is raised first, then the flame, then the raven, and last the skull."}),
    ("bunker", "keypad", "The Cold-War Frequency",
     "The radio still hums on a dead channel; a code is scrawled on the housing.",
     0.70, {"code": "1962", "clue": "The final transmission was dated to a single year: nineteen sixty-two."}),
    ("cyber", "riddle", "The Kernel's Question",
     "The terminal blinks a single prompt, waiting.",
     0.75, {"riddle": "I think a million thoughts a second yet hold none. I answer every question but ask only one. What am I?", "answer": "machine"}),
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
