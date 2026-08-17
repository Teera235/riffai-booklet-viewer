#!/usr/bin/env python3
"""Create a screen-optimized PDF while preserving the original master file."""

from __future__ import annotations

import argparse
import subprocess
import tempfile
from pathlib import Path

from PIL import Image


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--dpi", type=int, default=115)
    parser.add_argument("--quality", type=int, default=70)
    args = parser.parse_args()

    if not args.source.is_file():
        raise SystemExit(f"Source PDF not found: {args.source}")

    with tempfile.TemporaryDirectory(prefix="riffai-booklet-") as temp_dir:
        prefix = Path(temp_dir) / "page"
        subprocess.run(
            [
                "pdftocairo",
                "-jpeg",
                "-r",
                str(args.dpi),
                "-jpegopt",
                f"quality={args.quality},optimize=y,progressive=y",
                str(args.source),
                str(prefix),
            ],
            check=True,
        )

        page_paths = sorted(
            Path(temp_dir).glob("page-*.jpg"),
            key=lambda path: int(path.stem.rsplit("-", 1)[1]),
        )
        if not page_paths:
            raise SystemExit("No pages were rendered from the source PDF")

        pages = [Image.open(path).convert("RGB") for path in page_paths]
        try:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            pages[0].save(
                args.output,
                "PDF",
                save_all=True,
                append_images=pages[1:],
                resolution=args.dpi,
                quality=args.quality,
                optimize=True,
            )
        finally:
            for page in pages:
                page.close()

    size_mb = args.output.stat().st_size / (1024 * 1024)
    print(f"Created {args.output} ({size_mb:.1f} MiB)")


if __name__ == "__main__":
    main()
