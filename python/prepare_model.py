"""Download/cache MangaOCR weights during a server image build."""

import os
from pathlib import Path

project_root = Path(__file__).resolve().parent.parent
cache = Path(os.environ.get("MANGA_OCR_CACHE", project_root / ".model-cache"))
cache.mkdir(parents=True, exist_ok=True)
os.environ.setdefault("HF_HOME", str(cache))
os.environ.setdefault("HUGGINGFACE_HUB_CACHE", str(cache / "hub"))

from manga_ocr import MangaOcr

MangaOcr()
print(f"MangaOCR model cached under {cache}")
