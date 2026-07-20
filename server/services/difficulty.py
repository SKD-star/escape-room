"""Adaptive difficulty engine.

Maintains a per-user skill_rating in [0, 1] using an exponential moving
average over puzzle outcomes. Both the AI prompt builder and the
procedural generator scale puzzle complexity from this value.
"""
from models import PuzzleRecord, User

# EMA smoothing — higher alpha reacts faster to recent performance
ALPHA = 0.25
# Solve-time normalization: solving faster than FAST_S is "perfect",
# slower than SLOW_S contributes nothing.
FAST_S = 45
SLOW_S = 420


def _performance(record: PuzzleRecord) -> float:
    """Score a single puzzle attempt in [0, 1]."""
    if not record.solved:
        return 0.0
    time_score = max(0.0, min(1.0, (SLOW_S - record.solve_time_s) / (SLOW_S - FAST_S)))
    hint_penalty = min(0.5, record.hints_used * 0.15)
    return max(0.0, min(1.0, 0.35 + 0.65 * time_score - hint_penalty))


def update_skill_rating(user: User, record: PuzzleRecord) -> None:
    """EMA update + rolling aggregates. Caller commits the session."""
    perf = _performance(record)
    user.skill_rating = (1 - ALPHA) * user.skill_rating + ALPHA * perf

    if record.solved:
        n = user.puzzles_solved
        user.avg_solve_time_s = (user.avg_solve_time_s * n + record.solve_time_s) / (n + 1)
        user.puzzles_solved = n + 1
    else:
        user.puzzles_failed += 1
    user.hints_used += record.hints_used


def target_difficulty(user: User | None, base: float = 0.5) -> float:
    """Difficulty for the NEXT puzzle: room base blended toward player skill."""
    if user is None:
        return base
    # Keep players in flow: slightly above their skill, clamped
    desired = user.skill_rating * 0.8 + 0.15
    return max(0.1, min(0.95, base * 0.4 + desired * 0.6))
