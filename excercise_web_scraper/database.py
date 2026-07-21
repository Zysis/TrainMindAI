import sqlite3
import json
import os
from typing import Optional


DB_PATH = os.path.join(os.path.dirname(__file__), "exercises.db")


def get_connection(db_path: str = DB_PATH) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.row_factory = sqlite3.Row
    return conn


def init_db(db_path: str = DB_PATH) -> None:
    conn = get_connection(db_path)
    cur = conn.cursor()

    cur.executescript("""
        CREATE TABLE IF NOT EXISTS muscle_groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL
        );

        CREATE TABLE IF NOT EXISTS exercises (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            slug TEXT UNIQUE NOT NULL,
            description TEXT,
            difficulty TEXT,
            equipment TEXT,
            primary_muscle_group_id INTEGER,
            secondary_muscles TEXT,
            steps TEXT,
            url TEXT NOT NULL,
            image_path TEXT,
            gif_path TEXT,
            video_url TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (primary_muscle_group_id) REFERENCES muscle_groups(id)
        );

        CREATE INDEX IF NOT EXISTS idx_exercises_slug ON exercises(slug);
        CREATE INDEX IF NOT EXISTS idx_exercises_muscle ON exercises(primary_muscle_group_id);
    """)

    conn.commit()
    conn.close()


def get_or_create_muscle_group(conn: sqlite3.Connection, name: str) -> int:
    cur = conn.cursor()
    cur.execute("SELECT id FROM muscle_groups WHERE name = ?", (name,))
    row = cur.fetchone()
    if row:
        return row["id"]
    cur.execute("INSERT INTO muscle_groups (name) VALUES (?)", (name,))
    conn.commit()
    return cur.lastrowid


def upsert_exercise(conn: sqlite3.Connection, data: dict) -> int:
    muscle_group_id = None
    if data.get("primary_muscle_group"):
        muscle_group_id = get_or_create_muscle_group(conn, data["primary_muscle_group"])

    steps_json = json.dumps(data.get("steps", []), ensure_ascii=False) if data.get("steps") else None
    secondary_json = json.dumps(data.get("secondary_muscles", []), ensure_ascii=False) if data.get("secondary_muscles") else None

    cur = conn.cursor()
    cur.execute("SELECT id FROM exercises WHERE slug = ?", (data["slug"],))
    existing = cur.fetchone()

    if existing:
        cur.execute("""
            UPDATE exercises SET
                name = ?,
                description = ?,
                difficulty = ?,
                equipment = ?,
                primary_muscle_group_id = ?,
                secondary_muscles = ?,
                steps = ?,
                url = ?,
                image_path = ?,
                gif_path = ?,
                video_url = ?
            WHERE slug = ?
        """, (
            data.get("name"),
            data.get("description"),
            data.get("difficulty"),
            data.get("equipment"),
            muscle_group_id,
            secondary_json,
            steps_json,
            data.get("url"),
            data.get("image_path"),
            data.get("gif_path"),
            data.get("video_url"),
            data["slug"],
        ))
        conn.commit()
        return existing["id"]
    else:
        cur.execute("""
            INSERT INTO exercises (
                name, slug, description, difficulty, equipment,
                primary_muscle_group_id, secondary_muscles, steps,
                url, image_path, gif_path, video_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data.get("name"),
            data["slug"],
            data.get("description"),
            data.get("difficulty"),
            data.get("equipment"),
            muscle_group_id,
            secondary_json,
            steps_json,
            data.get("url"),
            data.get("image_path"),
            data.get("gif_path"),
            data.get("video_url"),
        ))
        conn.commit()
        return cur.lastrowid


def exercise_exists(conn: sqlite3.Connection, slug: str) -> bool:
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM exercises WHERE slug = ?", (slug,))
    return cur.fetchone() is not None


def export_to_json(db_path: str = DB_PATH, output_path: Optional[str] = None) -> str:
    if output_path is None:
        output_path = os.path.join(os.path.dirname(__file__), "exercises.json")

    conn = get_connection(db_path)
    cur = conn.cursor()
    cur.execute("""
        SELECT
            e.id, e.name, e.slug, e.description, e.difficulty, e.equipment,
            mg.name as primary_muscle_group,
            e.secondary_muscles, e.steps,
            e.url, e.image_path, e.gif_path, e.video_url, e.created_at
        FROM exercises e
        LEFT JOIN muscle_groups mg ON e.primary_muscle_group_id = mg.id
        ORDER BY mg.name, e.name
    """)

    exercises = []
    for row in cur.fetchall():
        exercise = dict(row)
        if exercise["steps"]:
            exercise["steps"] = json.loads(exercise["steps"])
        if exercise["secondary_muscles"]:
            exercise["secondary_muscles"] = json.loads(exercise["secondary_muscles"])
        exercises.append(exercise)

    conn.close()

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(exercises, f, ensure_ascii=False, indent=2)

    return output_path
