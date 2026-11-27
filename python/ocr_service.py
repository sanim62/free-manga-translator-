"""
ocr_service.py — Local manga OCR and speech bubble detection service.

Usage:
  echo '{"imageBase64": "data:image/jpeg;base64,..."}' | python3 python/ocr_service.py

Reads a JSON object from stdin with an "imageBase64" field,
detects speech bubbles via OpenCV contour analysis,
OCRs each bubble with manga-ocr,
and prints a JSON array of text blocks to stdout.

Dependencies (install with: pip install -r requirements.txt):
  manga-ocr, opencv-python, pillow, numpy
"""

import sys
import json
import base64
import os
from pathlib import Path
from contextlib import redirect_stdout

# Keep model files with the server deployment so restarts do not fetch them again.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
MODEL_CACHE = Path(os.environ.get("MANGA_OCR_CACHE", PROJECT_ROOT / ".model-cache"))
MODEL_CACHE.mkdir(parents=True, exist_ok=True)
os.environ.setdefault("HF_HOME", str(MODEL_CACHE))
os.environ.setdefault("HUGGINGFACE_HUB_CACHE", str(MODEL_CACHE / "hub"))
# The host build downloads model files first. The request worker stays offline
# so it never stalls on Hugging Face metadata checks for optional files.
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

import numpy as np
import cv2
from PIL import Image
from manga_ocr import MangaOcr

# Load the manga-ocr model once at startup.
# On first run this downloads ~400MB of model weights.
with redirect_stdout(sys.stderr):
    mocr = MangaOcr()


def decode_image(image_base64: str) -> np.ndarray:
    """Convert a base64 image string (with or without data URI prefix) to an OpenCV BGR array."""
    raw = image_base64.split(',')[-1]
    img_data = base64.b64decode(raw)
    img_array = np.frombuffer(img_data, np.uint8)
    return cv2.imdecode(img_array, cv2.IMREAD_COLOR)


def preprocess_for_detection(img: np.ndarray) -> np.ndarray:
    """
    Prepare the image so that speech bubble outlines are sharp and detectable.

    Pipeline:
    1. Grayscale conversion
    2. Fast non-local means denoising  — removes halftone scan dots
    3. Adaptive Gaussian threshold     — handles uneven lighting in scanned pages
    4. Morphological close             — seals small gaps in bubble outlines
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    denoised = cv2.fastNlMeansDenoising(gray, h=10)
    thresh = cv2.adaptiveThreshold(
        denoised, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        blockSize=15,
        C=4
    )
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=2)
    return closed


def detect_bubbles(img: np.ndarray) -> list:
    """Find enclosed light and dark bubble regions with connected components."""
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    min_area = w * h * 0.003
    max_component_area = w * h * 0.20
    # Connected white areas from clothing, skin, and furniture can resemble
    # balloons. Keep the paintable rectangle conservative; missed large
    # regions are safer than covering a character or panel artwork.
    max_rect_area = w * h * 0.06
    candidates = []

    for color, mode, threshold in (
        ("white", cv2.THRESH_BINARY, 220),
        ("black", cv2.THRESH_BINARY_INV, 55),
    ):
        _, binary = cv2.threshold(gray, threshold, 255, mode)
        count, labels, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=4)
        for label in range(1, count):
            x, y, bw, bh, area = [int(value) for value in stats[label]]
            rect_area = bw * bh
            touches_edge = x <= 1 or y <= 1 or x + bw >= w - 2 or y + bh >= h - 2
            if area < min_area or area > max_component_area or rect_area > max_rect_area or touches_edge:
                continue
            if bw < 20 or bh < 15:
                continue
            aspect = bw / bh
            if aspect < 0.25 or aspect > 2.5 or area / max(rect_area, 1) < 0.4:
                continue

            # Avoid painting over faces, clothing, doors, and bright furniture.
            # A real white balloon usually has a modest amount of dark lettering;
            # character artwork has much denser edges and many small components.
            region_gray = gray[y:y + bh, x:x + bw]
            if color == "white":
                dark_ink_ratio = float(np.mean(region_gray < 130))
                if dark_ink_ratio > 0.14:
                    continue
                _, glyph_mask = cv2.threshold(region_gray, 130, 255, cv2.THRESH_BINARY_INV)
            else:
                _, glyph_mask = cv2.threshold(region_gray, 200, 255, cv2.THRESH_BINARY)
            glyph_count, _, glyph_stats, _ = cv2.connectedComponentsWithStats(glyph_mask, connectivity=8)
            text_like_components = 0
            for glyph_label in range(1, glyph_count):
                gx, gy, gw, gh, glyph_area = [int(value) for value in glyph_stats[glyph_label]]
                if (glyph_area >= 3 and glyph_area <= rect_area * 0.025
                        and gw < bw * 0.45 and gh < bh * 0.45):
                    text_like_components += 1
            if text_like_components < 2 or text_like_components > 22:
                continue

            pad = 6
            x1, y1 = max(0, x - pad), max(0, y - pad)
            x2, y2 = min(w, x + bw + pad), min(h, y + bh + pad)
            component_mask = (labels[y:y + bh, x:x + bw] == label).astype(np.uint8)
            contours, _ = cv2.findContours(component_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if not contours:
                continue
            contour = max(contours, key=cv2.contourArea)
            epsilon = max(1.0, cv2.arcLength(contour, True) * 0.008)
            polygon = cv2.approxPolyDP(contour, epsilon, True).reshape(-1, 2)
            if len(polygon) < 3:
                continue
            bubble_polygon = [
                [int((x + int(px)) / w * 1000), int((y + int(py)) / h * 1000)]
                for px, py in polygon
            ]
            candidates.append({
                "box": {"x": x1, "y": y1, "w": x2 - x1, "h": y2 - y1},
                "box_2d": [int(y1 / h * 1000), int(x1 / w * 1000), int(y2 / h * 1000), int(x2 / w * 1000)],
                "bubble_polygon": bubble_polygon,
                "color": color,
            })

    candidates.sort(key=lambda b: (round(b["box"]["y"] / 140), -b["box"]["x"]))
    bubbles = []
    for candidate in candidates:
        a = candidate["box"]
        duplicate = False
        superseded = []
        for existing in bubbles:
            b = existing["box"]
            ix = max(0, min(a["x"] + a["w"], b["x"] + b["w"]) - max(a["x"], b["x"]))
            iy = max(0, min(a["y"] + a["h"], b["y"] + b["h"]) - max(a["y"], b["y"]))
            inter = ix * iy
            union = a["w"] * a["h"] + b["w"] * b["h"] - inter
            if candidate["color"] != existing["color"] or not union:
                continue
            overlap_of_smaller = inter / max(min(a["w"] * a["h"], b["w"] * b["h"]), 1)
            area_ratio = max(a["w"] * a["h"], b["w"] * b["h"]) / max(min(a["w"] * a["h"], b["w"] * b["h"]), 1)
            if overlap_of_smaller > 0.65 and area_ratio > 1.25:
                if a["w"] * a["h"] < b["w"] * b["h"]:
                    superseded.append(existing)
                    continue
                duplicate = True
                break
            if inter / union > 0.5:
                duplicate = True
                break
        for old_candidate in superseded:
            bubbles.remove(old_candidate)
        if not duplicate:
            x, y, bw, bh = a["x"], a["y"], a["w"], a["h"]
            candidate["crop_img"] = img[y:y + bh, x:x + bw]
            bubbles.append(candidate)
    return bubbles


def preprocess_bubble_for_ocr(crop: np.ndarray, color: str = "white") -> Image.Image:
    """
    Prepare a single bubble crop for manga-ocr.
    Upscales if smaller than 100px in any dimension
    (manga-ocr accuracy degrades on very small images).
    Converts BGR (OpenCV) → RGB (PIL).
    """
    h, w = crop.shape[:2]
    if h < 100 or w < 100:
        scale = max(100 / h, 100 / w)
        crop = cv2.resize(
            crop,
            (int(w * scale), int(h * scale)),
            interpolation=cv2.INTER_CUBIC
        )
    if color == "black":
        crop = cv2.bitwise_not(crop)
    rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
    return Image.fromarray(rgb)


def run(data: dict) -> list:
    """
    Main pipeline:
    1. Decode the base64 image
    2. Detect speech bubbles with OpenCV
    3. OCR each bubble with manga-ocr
    4. Return a list of text block dicts (en_text left blank for Node to fill)
    """
    img = decode_image(data["imageBase64"])
    bubbles = detect_bubbles(img)

    results = []
    for i, bubble in enumerate(bubbles):
        pil_img = preprocess_bubble_for_ocr(bubble["crop_img"], bubble["color"])
        with redirect_stdout(sys.stderr):
            ja_text = mocr(pil_img)

        results.append({
            "id": f"bubble_{i + 1}",
            "box_2d": bubble["box_2d"],
            "bubble_polygon": bubble["bubble_polygon"],
            "type": "speech_bubble",
            "reading_order": i + 1,
            "ja_text": ja_text,
            "en_text": "",        # filled in by Node dictionary layer
            "notes": "",
            "bubble_color": bubble["color"],
            "text_align": "center"
        })

    return results


if __name__ == '__main__':
    # Keep one model process alive and handle newline-delimited jobs. This is
    # important for a hosted service: model startup happens once, not per page.
    print(json.dumps({"type": "ready"}), flush=True)
    for line in sys.stdin:
        if not line.strip():
            continue
        request = None
        try:
            request = json.loads(line)
            blocks = run(request)
            print(json.dumps({"id": request.get("id"), "textBlocks": blocks}, ensure_ascii=False), flush=True)
        except Exception as error:
            print(json.dumps({"id": (request or {}).get("id"), "error": str(error)}, ensure_ascii=False), flush=True)
