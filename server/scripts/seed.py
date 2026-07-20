"""Seed data — room metadata + achievement catalogue. Idempotent."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import create_app
from extensions import db
from models import Achievement, RoomMeta

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
]


def main() -> None:
    app = create_app()
    with app.app_context():
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
        db.session.commit()
        print(f"[OK] Seeded {RoomMeta.query.count()} rooms, "
              f"{Achievement.query.count()} achievements")


if __name__ == "__main__":
    main()
