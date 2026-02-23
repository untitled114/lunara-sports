#!/usr/bin/env python3
"""Register Avro schemas with the Confluent Schema Registry.

Usage:
    python register_schemas.py [--url http://localhost:8081]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from confluent_kafka.schema_registry import Schema, SchemaRegistryClient

SCHEMA_DIR = Path(__file__).parent / "avro"

# topic → (subject-name, schema-file)
SUBJECTS = {
    "raw.scoreboard-value": "scoreboard_event.avsc",
    "raw.plays-value": "play_event.avsc",
    "enriched.plays-value": "enriched_event.avsc",
    "game.state-value": "game_state.avsc",
}


def register(registry_url: str) -> None:
    client = SchemaRegistryClient({"url": registry_url})

    for subject, filename in SUBJECTS.items():
        schema_path = SCHEMA_DIR / filename
        schema_str = schema_path.read_text()

        # Validate JSON
        json.loads(schema_str)

        schema = Schema(schema_str, schema_type="AVRO")

        # Set BACKWARD compatibility
        try:
            client.set_compatibility(subject_name=subject, level="BACKWARD")
        except Exception:
            pass  # subject may not exist yet

        schema_id = client.register_schema(subject_name=subject, schema=schema)
        print(f"  Registered {subject} → schema ID {schema_id}")

    print("\nAll schemas registered.")
    subjects = client.get_subjects()
    print(f"Subjects: {subjects}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Register Avro schemas")
    parser.add_argument(
        "--url",
        default="http://localhost:8081",
        help="Schema Registry URL (default: http://localhost:8081)",
    )
    args = parser.parse_args()

    try:
        register(args.url)
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
