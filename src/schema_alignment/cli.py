from __future__ import annotations

import argparse
from pathlib import Path

from .pipeline import match_csv_files


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Match CSV schemas between two files.")
    parser.add_argument("left_csv", type=Path, help="Path to the first CSV file")
    parser.add_argument("right_csv", type=Path, help="Path to the second CSV file")
    parser.add_argument(
        "--sample-size",
        type=int,
        default=20,
        help="Number of rows to sample from each column when computing value similarity",
    )
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    result = match_csv_files(
        args.left_csv,
        args.right_csv,
        sample_size=args.sample_size,
    )
    print(result.to_text())


if __name__ == "__main__":
    main()

