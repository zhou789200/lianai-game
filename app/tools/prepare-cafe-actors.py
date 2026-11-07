from pathlib import Path

import cv2
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "work" / "actors"
OUTPUT = ROOT / "public" / "art"


def cutout(image: np.ndarray) -> np.ndarray:
    """Remove the connected white backdrop while preserving enclosed white details."""
    height, width = image.shape[:2]
    flood = np.zeros((height + 2, width + 2), np.uint8)
    seeds = []
    for x in range(0, width, 16):
        seeds.extend([(x, 0), (x, height - 1)])
    for y in range(0, height, 16):
        seeds.extend([(0, y), (width - 1, y)])

    for seed in seeds:
        if flood[seed[1] + 1, seed[0] + 1]:
            continue
        cv2.floodFill(
            image,
            flood,
            seed,
            0,
            (6, 6, 6),
            (6, 6, 6),
            cv2.FLOODFILL_MASK_ONLY | 4 | (255 << 8),
        )

    alpha = 255 - flood[1:-1, 1:-1]
    count, labels, stats, _ = cv2.connectedComponentsWithStats((alpha > 0).astype(np.uint8), 8)
    if count > 1:
        areas = stats[1:, cv2.CC_STAT_AREA]
        retained = np.where(areas >= max(64, int(areas.max() * 0.008)))[0] + 1
        alpha = np.where(np.isin(labels, retained), alpha, 0).astype(np.uint8)
    rgba = cv2.cvtColor(image, cv2.COLOR_BGR2BGRA)
    rgba[:, :, 3] = alpha
    return trim(rgba)


def cutout_cat(image: np.ndarray) -> np.ndarray:
    """GrabCut keeps the white chest fur that flood fill mistakes for backdrop."""
    height, width = image.shape[:2]
    mask = np.zeros((height, width), np.uint8)
    bgd = np.zeros((1, 65), np.float64)
    fgd = np.zeros((1, 65), np.float64)
    rect = (
        max(0, round(width * 0.06)),
        max(0, round(height * 0.02)),
        round(width * 0.88),
        round(height * 0.95),
    )
    cv2.grabCut(image, mask, rect, bgd, fgd, 6, cv2.GC_INIT_WITH_RECT)
    alpha = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    alpha = cv2.morphologyEx(alpha, cv2.MORPH_OPEN, kernel)
    alpha = cv2.morphologyEx(alpha, cv2.MORPH_CLOSE, kernel)
    count, labels, stats, _ = cv2.connectedComponentsWithStats((alpha > 0).astype(np.uint8), 8)
    if count > 1:
        largest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        alpha = np.where(labels == largest, alpha, 0).astype(np.uint8)
    rgba = cv2.cvtColor(image, cv2.COLOR_BGR2BGRA)
    rgba[:, :, 3] = alpha
    return trim(rgba)


def trim(image: np.ndarray) -> np.ndarray:
    alpha = image[:, :, 3]
    points = cv2.findNonZero(alpha)
    if points is None:
        return image
    x, y, width, height = cv2.boundingRect(points)
    pad = 16
    x0 = max(0, x - pad)
    y0 = max(0, y - pad)
    x1 = min(image.shape[1], x + width + pad)
    y1 = min(image.shape[0], y + height + pad)
    return image[y0:y1, x0:x1]


def split_poses(path: Path, names: tuple[str, str, str]) -> None:
    image = cv2.imread(str(path))
    if image is None:
        raise RuntimeError(f"Unable to read {path}")

    height, width = image.shape[:2]
    for index, name in enumerate(names):
        start = round(width * index / 3)
        end = round(width * (index + 1) / 3)
        cutter = cutout_cat if "cat" in names[0] else cutout
        sprite = cutter(image[:, start:end].copy())
        output = OUTPUT / f"{name}.png"
        if not cv2.imwrite(str(output), sprite):
            raise RuntimeError(f"Unable to write {output}")
        print(f"{output.relative_to(ROOT)} {sprite.shape[1]}x{sprite.shape[0]}")


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for legacy in (
        OUTPUT / "cafe-barista-front.png.png",
        OUTPUT / "cafe-barista-side.png.png",
        OUTPUT / "cafe-barista-back.png.png",
        OUTPUT / "cafe-cat-front.png.png",
        OUTPUT / "cafe-cat-side.png.png",
        OUTPUT / "cafe-cat-back.png.png",
        OUTPUT / "scene-cafe-play.webp",
    ):
        legacy.unlink(missing_ok=True)
    split_poses(
        SOURCE / "barista-source.png",
        ("cafe-barista-front", "cafe-barista-side", "cafe-barista-back"),
    )
    split_poses(
        SOURCE / "cat-source.png",
        ("cafe-cat-front", "cafe-cat-side", "cafe-cat-back"),
    )


if __name__ == "__main__":
    main()
