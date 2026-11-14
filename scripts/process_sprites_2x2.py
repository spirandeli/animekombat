#!/usr/bin/env python3
import concurrent.futures
import glob
import io
import json
import math
import os
import re
import shutil
import sys
import zipfile
from collections import deque
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "assets" / "characters"
ICONS_DIR = ROOT / "public" / "icons"

DIRECTIONAL_ATTACK_PATTERNS = [
    (re.compile(rf"^(?:ataque|atk|attack)_?{n}(?:_.*)?_(?:{pat})(?:_|$)"), f"ataque_{n}_{suffix}")
    for n in range(1, 5)
    for pat, suffix in (
        ("diag_?up|diagonal_?up", "diag_up"),
        ("diag_?down|diagonal_?down", "diag_down"),
        ("up", "up"),
        ("down", "down"),
    )
]

ACTION_MAP_PATTERNS = [
    (re.compile(r"^idle$"), "idle"),
    *DIRECTIONAL_ATTACK_PATTERNS,
    (re.compile(r"^(?:ataque|atk|attack)_?1(?:_|$)"), "ataque_1"),
    (re.compile(r"^(?:ataque|atk|attack)_?2(?:_|$)"), "ataque_2"),
    (re.compile(r"^(?:ataque|atk|attack)_?3(?:_|$)"), "ataque_3"),
    (re.compile(r"^(?:ataque|atk|attack)_?4(?:_|$)"), "ataque_4"),
    (re.compile(r"^(?:move_)?(?:run|run_dash|air_dash)$"), "run"),
    (re.compile(r"^(?:move_)?jump$"), "jump"),
    (re.compile(r"^(?:move_)?crouch$"), "crouch"),
    (re.compile(r"^(?:combat_)?block$"), "block"),
    (re.compile(r"^(?:combat_)?hitstun$"), "hitstun"),
]

VFX_MAP_PATTERNS = [
    (re.compile(r"^vfx_(?:ataque|atk|attack)_?1(?:_|$)"), "vfx_ataque_1"),
    (re.compile(r"^vfx_(?:ataque|atk|attack)_?2(?:_|$)"), "vfx_ataque_2"),
    (re.compile(r"^vfx_(?:ataque|atk|attack)_?3(?:_|$)"), "vfx_ataque_3"),
    (re.compile(r"^vfx_(?:ataque|atk|attack)_?4(?:_|$)"), "vfx_ataque_4"),
]

PHASE_COLORS = {
    "goku": [
        ("#38bdf8", "Base"),
        ("#facc15", "Super Saiyajin"),
        ("#f59e0b", "Super Saiyajin 3"),
        ("#e2e8f0", "Instinto Superior"),
    ],
    "luffy": [
        ("#ef4444", "Base"),
        ("#f97316", "Gear 4: Boundman"),
        ("#c084fc", "Gear 4: Snakeman"),
        ("#f8fafc", "Gear 5"),
    ],
    "sukuna": [
        ("#fb7185", "1-3 Dedos"),
        ("#ef4444", "15 Dedos"),
        ("#818cf8", "Meguna"),
        ("#e11d48", "Era Heian"),
    ],
    "naruto": [
        ("#38bdf8", "Normal"),
        ("#ef4444", "Quatro Caudas"),
        ("#facc15", "Manto Kurama"),
        ("#fb7185", "Modo Bárion"),
    ],
}

CHAR_DISPLAY_NAMES = {
    "goku": "Son Goku",
    "luffy": "Monkey D. Luffy",
    "sukuna": "Ryomen Sukuna",
    "naruto": "Naruto Uzumaki",
}

MOVE_NAME_OVERRIDES = {
    ("sukuna", 1, "ataque_1"): "Punho Amaldiçoado",
    ("sukuna", 1, "ataque_2"): "Chute Sombrio",
    ("sukuna", 2, "ataque_1"): "Combo Impiedoso",
    ("sukuna", 2, "ataque_2"): "Corte Brutal",
}


def find_source_dir() -> Path:
    for name in ("spritesPersonagens", "spritesPersonagens "):
        p = ROOT / name
        if p.exists():
            return p
    raise FileNotFoundError("Pasta spritesPersonagens não encontrada na raiz do projeto.")


def prettify_slug(slug: str) -> str:
    words = [w for w in slug.split("_") if w]
    return " ".join(w.capitalize() for w in words)


LAYOUT_TAG_RE = re.compile(
    r"(?:(?:_|-)(?:3x2|6frames|2x2|2x1|2frames|extra|add2))+$"
)

EXTRA_INTERLEAVE_ORDER = {
    "crouch": ["F1", "E1", "F2", "E2", "F3", "F4"],
    "block": ["F1", "E1", "F2", "E2", "F3", "F4"],
    "default": ["F1", "E1", "F2", "F3", "E2", "F4"],
}


def detect_sheet_layout(stem: str) -> tuple[str, int, int, bool]:
    """Infere o layout do grid (cols, rows) e se é uma tira extra +2 frames."""
    m = LAYOUT_TAG_RE.search(stem.lower())
    suffix = m.group(0) if m else ""
    if "3x2" in suffix or "6frames" in suffix:
        return "3x2", 3, 2, False
    if any(tok in suffix for tok in ("2x1", "2frames", "extra", "add2")):
        return "2x1", 2, 1, True
    return "2x2", 2, 2, False


def extract_move_label(stem: str, canonical: str) -> str:
    clean_stem = LAYOUT_TAG_RE.sub("", stem.lower())
    cleaned = re.sub(r"^(?:vfx_)?(?:ataque|atk|attack)_?[1-4]_?", "", clean_stem)
    if not cleaned:
        num = canonical.split("_")[-1]
        return f"Golpe {num}"
    return prettify_slug(cleaned)


def parse_entry(source_path: Path, internal_path: str, folder_char: str, is_loose: bool = False):
    parts = [p for p in internal_path.replace("\\", "/").split("/") if p]
    if len(parts) < 2:
        return None
    if any(p.lower() == "frames_transparent_png" for p in parts[:-1]):
        return None
    filename = parts[-1]
    if not filename.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
        return None

    stem_raw = Path(filename).stem.lower()
    layout_name, cols, rows, is_extra = detect_sheet_layout(stem_raw)
    stem = LAYOUT_TAG_RE.sub("", stem_raw)
    is_vfx = (
        "vfx" in source_path.stem.lower()
        or any("vfx" in p.lower() for p in parts[:-1])
        or stem.startswith("vfx_")
    )

    phase_folder = None
    for part in parts[:-1]:
        if re.match(r"^fase_?[1-4]", part.lower()):
            phase_folder = part.lower()
            break
    if not phase_folder:
        return None

    m_phase = re.match(r"^fase_?([1-4])(?:_(.+))?$", phase_folder)
    if not m_phase:
        return None
    phase_num = int(m_phase.group(1))
    phase_slug = m_phase.group(2) or f"fase_{phase_num}"

    canonical = None
    patterns = VFX_MAP_PATTERNS if is_vfx else ACTION_MAP_PATTERNS
    for rx, act in patterns:
        if rx.match(stem):
            canonical = act
            break
    if not canonical:
        return None

    char_id_lower = folder_char.lower()
    move_label = extract_move_label(stem_raw, canonical) if ("ataque" in canonical) else canonical
    if "ataque" in canonical and not is_vfx:
        override = MOVE_NAME_OVERRIDES.get((char_id_lower, phase_num, canonical))
        if override and move_label.startswith("Golpe "):
            move_label = override

    return {
        "char_id": char_id_lower,
        "phase_num": phase_num,
        "phase_key": f"fase_{phase_num}",
        "phase_folder": phase_folder,
        "phase_slug": phase_slug,
        "is_vfx": is_vfx,
        "action": canonical,
        "move_label": move_label,
        "zip_path": str(source_path),
        "internal_path": internal_path,
        "is_loose": is_loose,
        "layout": layout_name,
        "cols": cols,
        "rows": rows,
        "is_extra": is_extra,
    }


def _strip_anomalous_vfx_bg(rgba: Image.Image) -> Image.Image:
    """Remove fundo sólido branco ou preto anômalo conectado às bordas de quadrantes VFX."""
    w, h = rgba.size
    if w < 16 or h < 16:
        return rgba
    buf = bytearray(rgba.tobytes())

    def px_at(x: int, y: int) -> tuple[int, int, int, int]:
        i = (y * w + x) * 4
        return buf[i], buf[i + 1], buf[i + 2], buf[i + 3]

    def is_white(r: int, g: int, b: int, a: int) -> bool:
        return a > 200 and r > 235 and g > 235 and b > 235 and (max(r, g, b) - min(r, g, b)) < 25

    def is_black(r: int, g: int, b: int, a: int) -> bool:
        return a > 200 and r < 20 and g < 20 and b < 20

    corners = [px_at(3, 3), px_at(w - 4, 3), px_at(3, h - 4), px_at(w - 4, h - 4)]
    step = max(8, w // 24)
    perim = (
        [px_at(x, 3) for x in range(3, w - 3, step)]
        + [px_at(x, h - 4) for x in range(3, w - 3, step)]
        + [px_at(3, y) for y in range(3, h - 3, step)]
        + [px_at(w - 4, y) for y in range(3, h - 3, step)]
    )

    white_corners = sum(1 for c in corners if is_white(*c))
    black_corners = sum(1 for c in corners if is_black(*c))
    white_perim = sum(1 for p in perim if is_white(*p)) / max(1, len(perim))
    black_perim = sum(1 for p in perim if is_black(*p)) / max(1, len(perim))

    mode = None
    if white_corners >= 3 and white_perim >= 0.72:
        mode = "white"
    elif black_corners >= 3 and black_perim >= 0.72:
        mode = "black"
    if not mode:
        return rgba

    def matches_bg(idx: int) -> bool:
        r, g, b, a = buf[idx], buf[idx + 1], buf[idx + 2], buf[idx + 3]
        if a <= 20:
            return False
        if mode == "white":
            return r > 218 and g > 218 and b > 218 and (max(r, g, b) - min(r, g, b)) < 34
        return r < 32 and g < 32 and b < 32

    visited = bytearray(w * h)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            pos = y * w + x
            if not visited[pos] and matches_bg(pos * 4):
                visited[pos] = 1
                q.append(pos)
    for y in range(1, h - 1):
        for x in (0, w - 1):
            pos = y * w + x
            if not visited[pos] and matches_bg(pos * 4):
                visited[pos] = 1
                q.append(pos)

    while q:
        pos = q.popleft()
        buf[pos * 4 + 3] = 0
        x = pos % w
        y = pos // w
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h:
                npos = ny * w + nx
                if not visited[npos] and matches_bg(npos * 4):
                    visited[npos] = 1
                    q.append(npos)

    return Image.frombytes("RGBA", (w, h), bytes(buf))


def _clear_safety_border(rgba: Image.Image, margin: int = 1) -> Image.Image:
    """Zera margem mínima nas bordas do quadrante para remover linhas divisórias finas do grid."""
    w, h = rgba.size
    if margin <= 0 or w <= margin * 2 or h <= margin * 2:
        return rgba
    buf = bytearray(rgba.tobytes())
    for y in range(h):
        row_start = y * w * 4
        if y < margin or y >= h - margin:
            for x in range(w):
                buf[row_start + x * 4 + 3] = 0
        else:
            for x in range(margin):
                buf[row_start + x * 4 + 3] = 0
                buf[row_start + (w - 1 - x) * 4 + 3] = 0
    return Image.frombytes("RGBA", (w, h), bytes(buf))


def _strip_grid_border_lines(rgba: Image.Image, depth: int = 4) -> Image.Image:
    """Remove linhas divisórias escuras residuais (2-4px) nas bordas de células com grade desenhada."""
    w, h = rgba.size
    if w <= depth * 4 or h <= depth * 4:
        return rgba
    buf = bytearray(rgba.tobytes())
    changed = False

    def is_dark_row(y: int) -> bool:
        hits = 0
        samples = 0
        row_start = y * w * 4
        for x in range(0, w, 3):
            samples += 1
            i = row_start + x * 4
            if buf[i + 3] > 128 and buf[i] < 60 and buf[i + 1] < 60 and buf[i + 2] < 60:
                hits += 1
        return samples > 0 and (hits / samples) >= 0.65

    def is_dark_col(x: int) -> bool:
        hits = 0
        samples = 0
        for y in range(0, h, 3):
            samples += 1
            i = (y * w + x) * 4
            if buf[i + 3] > 128 and buf[i] < 60 and buf[i + 1] < 60 and buf[i + 2] < 60:
                hits += 1
        return samples > 0 and (hits / samples) >= 0.65

    for y in list(range(1, depth)) + list(range(h - depth, h - 1)):
        if is_dark_row(y):
            changed = True
            row_start = y * w * 4
            for x in range(w):
                buf[row_start + x * 4 + 3] = 0

    for x in list(range(1, depth)) + list(range(w - depth, w - 1)):
        if is_dark_col(x):
            changed = True
            for y in range(h):
                buf[(y * w + x) * 4 + 3] = 0

    return Image.frombytes("RGBA", (w, h), bytes(buf)) if changed else rgba


def _feather_clipped_edges(rgba: Image.Image, is_vfx: bool) -> tuple[Image.Image, list[str]]:
    """Suaviza com gradiente cosseno bordas cortadas no limite da célula sem apagar pés normais."""
    w, h = rgba.size
    if w < 24 or h < 24:
        return rgba, []

    buf = bytearray(rgba.tobytes())
    sample_band = 4
    thresh = 28

    def count_hits_x(y_start: int, y_end: int) -> int:
        hits = 0
        for x in range(1, w - 1):
            for y in range(max(1, y_start), min(h - 1, y_end)):
                if buf[(y * w + x) * 4 + 3] > thresh:
                    hits += 1
                    break
        return hits

    def count_hits_y(x_start: int, x_end: int) -> int:
        hits = 0
        for y in range(1, h - 1):
            for x in range(max(1, x_start), min(w - 1, x_end)):
                if buf[(y * w + x) * 4 + 3] > thresh:
                    hits += 1
                    break
        return hits

    min_edge_px = 10 if is_vfx else 14
    clipped: list[str] = []
    if count_hits_x(1, 1 + sample_band) >= min_edge_px:
        clipped.append("T")
    if count_hits_y(1, 1 + sample_band) >= min_edge_px:
        clipped.append("L")
    if count_hits_y(w - 1 - sample_band, w - 1) >= min_edge_px:
        clipped.append("R")

    b_hits = count_hits_x(h - 1 - sample_band, h - 1)
    if is_vfx:
        if b_hits >= min_edge_px:
            clipped.append("B")
    elif b_hits >= int(w * 0.56):
        # Somente ondas/explosões de base larga em sprites de personagem suavizam na base; pés ficam intactos.
        clipped.append("B")

    if not clipped:
        return rgba, []

    depth_v = min(32 if is_vfx else 22, max(14, h // (13 if is_vfx else 19)))
    depth_h = min(32 if is_vfx else 22, max(14, w // (13 if is_vfx else 19)))

    ramp_v = [
        0.5 * (1.0 - math.cos(math.pi * d / depth_v)) if d > 0 else 0.0
        for d in range(depth_v)
    ]
    ramp_h = [
        0.5 * (1.0 - math.cos(math.pi * d / depth_h)) if d > 0 else 0.0
        for d in range(depth_h)
    ]

    top_on = "T" in clipped
    bot_on = "B" in clipped
    left_on = "L" in clipped
    right_on = "R" in clipped

    for y in range(h):
        fy = 1.0
        if top_on and y < depth_v:
            fy *= ramp_v[y]
        if bot_on and y >= h - depth_v:
            fy *= ramp_v[h - 1 - y]

        row_off = y * w * 4
        for x in range(w):
            fx = 1.0
            if left_on and x < depth_h:
                fx *= ramp_h[x]
            if right_on and x >= w - depth_h:
                fx *= ramp_h[w - 1 - x]
            factor = fx * fy
            if factor < 0.999:
                ai = row_off + x * 4 + 3
                buf[ai] = int(buf[ai] * factor)

    return Image.frombytes("RGBA", (w, h), bytes(buf)), clipped


def _remove_bleed_islands(
    rgba: Image.Image,
    row: int,
    col: int,
    rows: int,
    cols: int,
) -> Image.Image:
    """Remove ilhas desconectadas nas divisórias de corte (vazamento entre frames do grid)."""
    w, h = rgba.size
    buf = bytearray(rgba.tobytes())
    thresh = 24

    runs = []
    row_ranges = []
    for y in range(h):
        row_start = len(runs)
        off = y * w * 4
        x = 0
        while x < w:
            if buf[off + x * 4 + 3] > thresh:
                xs = x
                x += 1
                while x < w and buf[off + x * 4 + 3] > thresh:
                    x += 1
                runs.append((y, xs, x))
            else:
                x += 1
        row_ranges.append((row_start, len(runs)))

    n = len(runs)
    if n == 0:
        return rgba

    parent = list(range(n))

    def find(a: int) -> int:
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    def union(a: int, b: int) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    for y in range(h - 1):
        s1, e1 = row_ranges[y]
        s2, e2 = row_ranges[y + 1]
        i, j = s1, s2
        while i < e1 and j < e2:
            _, x0a, x1a = runs[i]
            _, x0b, x1b = runs[j]
            if x0a <= x1b and x0b <= x1a:
                union(i, j)
            if x1a < x1b:
                i += 1
            else:
                j += 1

    comps = {}
    for idx, (y, xs, xe) in enumerate(runs):
        r = find(idx)
        c = comps.get(r)
        length = xe - xs
        if c is None:
            comps[r] = [length, xs, y, xe, y + 1, [(y, xs, xe)]]
        else:
            c[0] += length
            if xs < c[1]:
                c[1] = xs
            if y < c[2]:
                c[2] = y
            if xe > c[3]:
                c[3] = xe
            if y + 1 > c[4]:
                c[4] = y + 1
            c[5].append((y, xs, xe))

    if len(comps) <= 1:
        return rgba

    ordered = sorted(comps.values(), key=lambda c: c[0], reverse=True)
    main = ordered[0]
    main_area = max(1, main[0])
    mx0, _, mx1, _ = main[1], main[2], main[3], main[4]

    modified = False
    for area, cx0, cy0, cx1, cy1, comp_runs in ordered[1:]:
        ratio = area / main_area
        left_bleed = col > 0 and cx0 <= 8 and ratio < 0.42
        # Preserva projéteis/golpes frontais grandes em células não-direitas, remove apenas lascas pequenas de aura
        right_bleed = col < cols - 1 and cx1 >= w - 9 and ratio < 0.03
        top_bleed = row > 0 and cy0 <= 8 and ratio < 0.15
        bottom_bleed = (
            row < rows - 1
            and cy1 >= h - 9
            and (cx1 < mx0 or cx0 > mx1)
            and ratio < 0.05
        )
        if left_bleed or right_bleed or top_bleed or bottom_bleed:
            modified = True
            for ry, xs, xe in comp_runs:
                off = ry * w * 4
                for x in range(xs, xe):
                    buf[off + x * 4 + 3] = 0

    if not modified:
        return rgba
    return Image.frombytes("RGBA", (w, h), bytes(buf))


def _compute_body_center_x(cropped: Image.Image, quad_h: int) -> float:
    """Localiza o eixo horizontal central do corpo (ignorando feixes, punhos esticados e fumaça)."""
    fw, fh = cropped.size
    eff_h = min(fh, int(round(quad_h * 0.80))) if quad_h >= 420 else fh
    win_w = min(fw, max(40, int(round(eff_h * 0.68))))
    if fw <= win_w + 18:
        return fw * 0.5

    px = cropped.tobytes()
    y_t1 = int(fh * 0.25)
    y_b0 = int(fh * 0.78)

    col_char = [0] * fw
    col_top = [0] * fw
    col_bot = [0] * fw
    col_all = [0] * fw

    for y in range(fh):
        row_off = y * fw * 4
        is_t = y < y_t1
        is_b = y >= y_b0
        for x in range(fw):
            i = row_off + x * 4
            if px[i + 3] > 128:
                col_all[x] += 1
                r, g, b = px[i], px[i + 1], px[i + 2]
                mx, mn = max(r, g, b), min(r, g, b)
                if mx < 205 or (mx - mn) > 30:
                    col_char[x] += 1
                    if is_t:
                        col_top[x] += 1
                    if is_b:
                        col_bot[x] += 1

    if max(col_char) < fh * 0.15:
        col_char = col_all
        col_top = [0] * fw
        col_bot = [0] * fw
        for y in range(fh):
            row_off = y * fw * 4
            is_t = y < y_t1
            is_b = y >= y_b0
            for x in range(fw):
                if px[row_off + x * 4 + 3] > 128:
                    if is_t:
                        col_top[x] += 1
                    if is_b:
                        col_bot[x] += 1

    def psum(arr):
        s = [0] * (fw + 1)
        for idx, v in enumerate(arr):
            s[idx + 1] = s[idx] + v
        return s

    pc, pt, pb = psum(col_char), psum(col_top), psum(col_bot)
    best_x0 = 0
    best_score = -1.0
    for x0 in range(0, fw - win_w + 1):
        x1 = x0 + win_w
        mc = pc[x1] - pc[x0]
        mt = pt[x1] - pt[x0]
        mb = pb[x1] - pb[x0]
        vertical_balance = min(mt, mb * 1.4)
        score = 0.35 * mc + 6.0 * vertical_balance + 6.0 * mb
        if score > best_score:
            best_score = score
            best_x0 = x0

    x1 = best_x0 + win_w
    tot = sum(col_char[x] for x in range(best_x0, x1))
    if tot > 0:
        cent = sum(x * col_char[x] for x in range(best_x0, x1)) / tot
        win_mid = best_x0 + win_w * 0.5
        return cent * 0.5 + win_mid * 0.5
    return fw * 0.5


def chroma_key_quad(quad: Image.Image, is_vfx: bool) -> tuple[Image.Image, list[str]]:
    """Remove fundo magenta #FF00FF com descontaminação de cor nas bordas e feather anti-corte."""
    rgba = quad.convert("RGBA")
    r, g, b, _ = rgba.split()
    min_rb = ImageChops.darker(r, b)
    excess_mag = ImageChops.subtract(min_rb, g)

    # Limiar mais restrito para evitar véu rosado em auras claras / nuvens / fumaça
    low_t = 36 if is_vfx else 32
    high_t = 112 if is_vfx else 100
    span = max(1, high_t - low_t)

    alpha = excess_mag.point(
        lambda m: 0 if m >= high_t else (255 if m <= low_t else int(255 * (high_t - m) / span))
    )

    # Zona morfológica de borda (~4px ao redor da transparência + pixels semi-transparentes)
    trans_mask = alpha.point(lambda p: 255 if p < 245 else 0)
    near_trans = trans_mask.filter(ImageFilter.MaxFilter(9))

    # Interior sólido preserva fidelidade cromática (cabelo rosa Sukuna, colete vermelho Luffy)
    spill_interior = 42 if is_vfx else 32
    int_spill = excess_mag.point(lambda m: max(0, m - spill_interior))
    r_int = ImageChops.subtract(r, int_spill)
    b_int = ImageChops.subtract(b, int_spill)

    # Borda / semi-transparente aplica color unmixing forte sobre resíduos de #FF00FF
    spill_edge = 8 if is_vfx else 10
    edge_spill = excess_mag.point(
        lambda m: min(255, int((m - spill_edge) * 1.45)) if m > spill_edge else 0
    )
    r_edge = ImageChops.subtract(r, edge_spill)
    b_edge = ImageChops.subtract(b, edge_spill)

    r_clean = Image.composite(r_edge, r_int, near_trans)
    b_clean = Image.composite(b_edge, b_int, near_trans)

    # Atenua halos semi-transparentes ainda muito magentas nas franjas externas
    w, h = rgba.size
    res_rgba = Image.merge("RGBA", (r_clean, g, b_clean, alpha))
    rb = res_rgba.tobytes()
    ex_b = excess_mag.tobytes()
    nt_b = near_trans.tobytes()
    buf = bytearray(rb)
    for i in range(w * h):
        ai = i * 4 + 3
        a = buf[ai]
        if a == 0:
            continue
        nt = nt_b[i]
        ex = ex_b[i]
        if nt > 0 and a < 245:
            # Descontamina proporção residual (1 - a_norm) * magenta no foreground
            inv_a = 1.0 - (a / 255.0)
            drop = int(inv_a * min(190, ex * 1.8))
            if drop > 0:
                buf[i * 4] = max(0, buf[i * 4] - drop)
                buf[i * 4 + 2] = max(0, buf[i * 4 + 2] - drop)
            if a < 115 and ex > 18:
                buf[ai] = max(0, int(a * max(0.0, 1.0 - (ex - 18) / 38.0)))

    result = Image.frombytes("RGBA", (w, h), bytes(buf))
    if is_vfx:
        result = _strip_anomalous_vfx_bg(result)
    result = _clear_safety_border(result, margin=1)
    result = _strip_grid_border_lines(result)
    return _feather_clipped_edges(result, is_vfx)


def _compute_vfx_anchor(cropped: Image.Image, bbox: tuple[int, int, int, int], x0: int, y0: int, quad_w: int, quad_h: int, action: str) -> tuple[float, float]:
    """Calcula âncora estável para VFX evitando saltos entre frames durante expansão."""
    bx0, by0, bx1, by1 = bbox
    bbox_cx = ((bx0 + bx1) * 0.5) - x0
    bbox_cy = ((by0 + by1) * 0.5) - y0

    # Centróide ponderado pelos pixels mais densos/brilhantes
    w, h = cropped.size
    pix = cropped.tobytes()
    sum_w = 0.0
    sum_x = 0.0
    sum_y = 0.0
    for y in range(0, h, 2):
        row = y * w * 4
        for x in range(0, w, 2):
            off = row + x * 4
            a = pix[off + 3]
            if a < 40:
                continue
            lum = (pix[off] + pix[off + 1] + pix[off + 2]) * 0.3333
            wt = (a / 255.0) * (0.4 + 0.6 * (lum / 255.0))
            sum_w += wt
            sum_x += x * wt
            sum_y += y * wt

    core_cx = (sum_x / sum_w) if sum_w > 0 else bbox_cx
    core_cy = (sum_y / sum_w) if sum_w > 0 else bbox_cy
    q_cx_rel = (quad_w * 0.5) - x0
    q_cy_rel = (quad_h * 0.5) - y0

    if action in ("vfx_ataque_1", "vfx_ataque_4"):
        ax = core_cx * 0.50 + bbox_cx * 0.30 + q_cx_rel * 0.20
        ay = core_cy * 0.50 + bbox_cy * 0.30 + q_cy_rel * 0.20
    else:
        ax = core_cx * 0.60 + bbox_cx * 0.40
        ay = core_cy * 0.55 + bbox_cy * 0.25 + q_cy_rel * 0.20

    return round(max(0.0, min(float(w), ax)), 1), round(max(0.0, min(float(h), ay)), 1)


def _open_sheet_image(task: dict) -> Image.Image:
    if task.get("is_loose"):
        return Image.open(task["internal_path"]).convert("RGBA")
    with zipfile.ZipFile(task["zip_path"], "r") as zf:
        raw = zf.read(task["internal_path"])
    return Image.open(io.BytesIO(raw))


def process_sheet_task(task: dict) -> dict:
    char_id = task["char_id"]
    phase_key = task["phase_key"]
    action = task["action"]
    is_vfx = task["is_vfx"]
    cols = int(task.get("cols", 2))
    rows = int(task.get("rows", 2))
    is_extra = bool(task.get("is_extra", False))

    im = _open_sheet_image(task)
    w, h = im.size
    qw, qh = w // cols, h // rows

    cells: list[tuple[int, int, tuple[int, int, int, int]]] = []
    for r_idx in range(rows):
        y_top = r_idx * qh
        y_bot = (r_idx + 1) * qh if r_idx < rows - 1 else h
        for c_idx in range(cols):
            x_left = c_idx * qw
            x_right = (c_idx + 1) * qw if c_idx < cols - 1 else w
            cells.append((r_idx, c_idx, (x_left, y_top, x_right, y_bot)))

    if is_vfx:
        out_folder = OUT_DIR / char_id / phase_key / "vfx" / action
    else:
        out_folder = OUT_DIR / char_id / phase_key / action
    if is_extra:
        out_folder = out_folder / "_extra_tmp"
    out_folder.mkdir(parents=True, exist_ok=True)

    frames_meta = []
    prefix = "extra" if is_extra else "frame"
    for idx, (r_idx, c_idx, box) in enumerate(cells, start=1):
        quad = im.crop(box)
        keyed, clipped_edges = chroma_key_quad(quad, is_vfx)
        if not is_vfx:
            keyed = _remove_bleed_islands(keyed, r_idx, c_idx, rows, cols)

        # Encontra bounding box de pixels visíveis (alpha > 18)
        alpha_band = keyed.getchannel("A")
        mask = alpha_band.point(lambda p: 255 if p > 18 else 0)
        bbox = mask.getbbox()
        if not bbox:
            bbox = (0, 0, quad.width, quad.height)

        # Padding de 2px mantendo limites da célula
        pad = 2
        x0 = max(0, bbox[0] - pad)
        y0 = max(0, bbox[1] - pad)
        x1 = min(quad.width, bbox[2] + pad)
        y1 = min(quad.height, bbox[3] + pad)

        cropped = keyed.crop((x0, y0, x1, y1))
        out_file = out_folder / f"{prefix}_{idx}.webp"
        cropped.save(out_file, format="WEBP", quality=88, method=4)

        rel_path = "/" + out_file.relative_to(ROOT / "public").as_posix()
        meta_entry = {
            "src": rel_path,
            "w": cropped.width,
            "h": cropped.height,
            "quadW": quad.width,
            "quadH": quad.height,
            "bboxInQuad": [bbox[0], bbox[1], bbox[2], bbox[3]],
            "cropOrigin": [x0, y0],
            "rawW": bbox[2] - bbox[0],
            "rawH": bbox[3] - bbox[1],
            "clippedEdges": clipped_edges,
        }
        if is_vfx:
            ax, ay = _compute_vfx_anchor(cropped, bbox, x0, y0, quad.width, quad.height, action)
            meta_entry["anchorX"] = ax
            meta_entry["anchorY"] = ay
        else:
            meta_entry["bodyCenterX"] = round(_compute_body_center_x(cropped, quad.height), 1)
        frames_meta.append(meta_entry)

    return {
        "char_id": char_id,
        "phase_num": task["phase_num"],
        "phase_key": phase_key,
        "phase_slug": task["phase_slug"],
        "is_vfx": is_vfx,
        "action": action,
        "move_label": task["move_label"],
        "is_extra": is_extra,
        "layout": task.get("layout", "2x2"),
        "frames": frames_meta,
    }


DIRECTIONAL_ANGLES_CCW = {
    "up": 74.0,
    "diag_up": 35.0,
    "diag_down": -35.0,
    "down": -74.0,
}


def directional_frame_modifiers(idx: int, total_count: int, base_action: str) -> tuple[float, float]:
    """Curva contínua de inclinação e pico de escala compatível com 4, 6 ou N quadros."""
    if total_count <= 1:
        return 1.0, 1.0
    u = idx / float(total_count - 1)
    angle_mult = 0.72 + 0.35 * math.sin(math.pi * u)
    peak_scale = 1.04 if (0.38 <= u <= 0.72 and base_action in ("ataque_3", "ataque_4")) else 1.0
    return angle_mult, peak_scale


def _compute_phase_ref_size(phase_data: dict) -> tuple[int, int]:
    idle_frames = phase_data["actions"].get("idle", [])
    if idle_frames:
        ref_f = idle_frames[0]
        raw_ref_h = max(1, ref_f["rawH"])
        quad_h = ref_f.get("quadH", raw_ref_h)
        ref_h = min(raw_ref_h, round(quad_h * 0.79)) if quad_h >= 420 else raw_ref_h
        ref_w = max(1, ref_f["rawW"])
        return ref_w, ref_h
    return 260, 350


def _synthesize_directional_task(task: dict) -> dict:
    char_id = task["char_id"]
    phase_key = task["phase_key"]
    base_action = task["base_action"]
    dir_suffix = task["dir_suffix"]
    target_action = f"{base_action}_{dir_suffix}"
    base_frames = task["base_frames"]
    ref_h = task["ref_h"]

    out_folder = OUT_DIR / char_id / phase_key / target_action
    out_folder.mkdir(parents=True, exist_ok=True)

    base_angle = DIRECTIONAL_ANGLES_CCW[dir_suffix]
    frames_meta = []
    total_frames = len(base_frames)

    for idx, bf in enumerate(base_frames, start=1):
        src_path = ROOT / "public" / bf["src"].lstrip("/")
        base_img = Image.open(src_path).convert("RGBA")
        bw, bh = base_img.size

        margin = 10
        work = Image.new("RGBA", (bw + margin * 2, bh + margin * 2), (0, 0, 0, 0))
        work.paste(base_img, (margin, margin))

        angle_mult, peak_scale = directional_frame_modifiers(idx - 1, total_frames, base_action)
        if peak_scale != 1.0:
            new_sz = (max(1, round(work.width * peak_scale)), max(1, round(work.height * peak_scale)))
            work = work.convert("RGBa").resize(new_sz, Image.Resampling.BICUBIC).convert("RGBA")

        W, H = work.size
        scx, scy = W * 0.5, H * 0.5
        base_ax = max(bw * 0.12, min(bw * 0.88, float(bf.get("bodyCenterX", bf.get("anchorX", bw * 0.5)))))
        base_ay = float(bf["bboxInQuad"][3] - bf["cropOrigin"][1])

        torso_src_x = (base_ax + margin) * peak_scale
        torso_src_y = (bh * 0.48 + margin) * peak_scale

        angle_deg = base_angle * angle_mult

        rot = work.convert("RGBa").rotate(
            angle_deg, resample=Image.Resampling.BICUBIC, expand=True
        ).convert("RGBA")

        nW, nH = rot.size
        dcx, dcy = nW * 0.5, nH * 0.5
        rad = math.radians(angle_deg)
        c, sn = math.cos(rad), math.sin(rad)

        dx_t = torso_src_x - scx
        dy_t = torso_src_y - scy
        rot_torso_x = dcx + dx_t * c + dy_t * sn
        rot_torso_y = dcy - dx_t * sn + dy_t * c

        alpha_band = rot.getchannel("A")
        mask = alpha_band.point(lambda p: 255 if p > 18 else 0)
        bbox = mask.getbbox()
        if not bbox:
            bbox = (0, 0, nW, nH)

        pad = 2
        x0 = max(0, bbox[0] - pad)
        y0 = max(0, bbox[1] - pad)
        x1 = min(nW, bbox[2] + pad)
        y1 = min(nH, bbox[3] + pad)
        cropped = rot.crop((x0, y0, x1, y1))

        out_file = out_folder / f"frame_{idx}.webp"
        cropped.save(out_file, format="WEBP", quality=88, method=4)

        cw, ch = cropped.size
        quad_h = bf.get("quadH", max(ch, bh))
        t_x = rot_torso_x - x0
        t_y = rot_torso_y - y0
        by1_rel = float(bbox[3] - y0)
        body_cx = _compute_body_center_x(cropped, quad_h)

        ax_mix = (0.65 * t_x + 0.35 * body_cx) if dir_suffix in ("up", "down") else (0.45 * t_x + 0.55 * body_cx)
        anchor_x = round(max(cw * 0.14, min(cw * 0.86, ax_mix)), 1)

        if dir_suffix in ("up", "diag_up"):
            anchor_y = round(min(float(ch), max(ch * 0.65, by1_rel)), 1)
        else:
            torso_foot_offset = (0.48 if dir_suffix == "diag_down" else 0.45) * ref_h
            ideal_ay = t_y + torso_foot_offset
            min_ay = ch * (0.50 if dir_suffix == "diag_down" else 0.38)
            max_ay = min(float(ch - 1), by1_rel)
            anchor_y = round(max(min_ay, min(max_ay, ideal_ay)), 1)

        rel_path = "/" + out_file.relative_to(ROOT / "public").as_posix()
        frames_meta.append({
            "src": rel_path,
            "w": cw,
            "h": ch,
            "quadW": bf.get("quadW", cw),
            "quadH": quad_h,
            "bboxInQuad": [bbox[0], bbox[1], bbox[2], bbox[3]],
            "cropOrigin": [x0, y0],
            "rawW": bbox[2] - bbox[0],
            "rawH": bbox[3] - bbox[1],
            "anchorX": anchor_x,
            "anchorY": anchor_y,
        })

    return {
        "char_id": char_id,
        "phase_key": phase_key,
        "target_action": target_action,
        "frames": frames_meta,
    }


def synthesize_directional_attacks(characters: dict, workers: int) -> int:
    """Gera sprites WebP direcionais (up, diag_up, diag_down, down) a partir de ataque_1..4."""
    synth_tasks = []
    for char_id, cdata in characters.items():
        for phase_key, pdata in cdata["phases"].items():
            actions = pdata["actions"]
            _, ref_h = _compute_phase_ref_size(pdata)
            for base_action in ("ataque_1", "ataque_2", "ataque_3", "ataque_4"):
                base_frames = actions.get(base_action)
                if not base_frames:
                    continue
                for dir_suffix in ("up", "diag_up", "diag_down", "down"):
                    target_action = f"{base_action}_{dir_suffix}"
                    if target_action in actions and len(actions[target_action]) > 0:
                        continue
                    synth_tasks.append({
                        "char_id": char_id,
                        "phase_key": phase_key,
                        "base_action": base_action,
                        "dir_suffix": dir_suffix,
                        "base_frames": base_frames,
                        "ref_h": ref_h,
                    })

    if not synth_tasks:
        return 0

    total_out = sum(len(t["base_frames"]) for t in synth_tasks)
    print(f"Gerando {len(synth_tasks)} conjuntos direcionais de ataque ({total_out} quadros) em paralelo...")
    with concurrent.futures.ProcessPoolExecutor(max_workers=workers) as ex:
        for res in ex.map(_synthesize_directional_task, synth_tasks):
            characters[res["char_id"]]["phases"][res["phase_key"]]["actions"][res["target_action"]] = res["frames"]
    return len(synth_tasks)


def _interleave_extra_frames(action: str, base_frames: list[dict], extra_frames: list[dict], char_id: str, phase_key: str, is_vfx: bool) -> list[dict]:
    """Mescla 2 quadros extras [E1, E2] aos 4 quadros base [F1..F4] mantendo frame_1..frame_6 sequenciais."""
    if len(base_frames) != 4 or len(extra_frames) < 2:
        return base_frames
    order = EXTRA_INTERLEAVE_ORDER.get(action, EXTRA_INTERLEAVE_ORDER["default"])
    slot_map = {
        "F1": base_frames[0],
        "F2": base_frames[1],
        "F3": base_frames[2],
        "F4": base_frames[3],
        "E1": extra_frames[0],
        "E2": extra_frames[1],
    }
    out_folder = (OUT_DIR / char_id / phase_key / "vfx" / action) if is_vfx else (OUT_DIR / char_id / phase_key / action)
    tmp_dir = out_folder / "_merge_tmp"
    tmp_dir.mkdir(parents=True, exist_ok=True)

    merged: list[dict] = []
    staged: list[tuple[Path, Path, dict]] = []
    for idx, token in enumerate(order, start=1):
        src_meta = dict(slot_map[token])
        src_file = ROOT / "public" / src_meta["src"].lstrip("/")
        tmp_file = tmp_dir / f"frame_{idx}.webp"
        final_file = out_folder / f"frame_{idx}.webp"
        shutil.copy2(src_file, tmp_file)
        staged.append((tmp_file, final_file, src_meta))

    for idx, (tmp_file, final_file, src_meta) in enumerate(staged, start=1):
        shutil.move(str(tmp_file), str(final_file))
        src_meta["src"] = "/" + final_file.relative_to(ROOT / "public").as_posix()
        merged.append(src_meta)

    extra_tmp = out_folder / "_extra_tmp"
    if extra_tmp.exists():
        shutil.rmtree(extra_tmp, ignore_errors=True)
    if tmp_dir.exists():
        shutil.rmtree(tmp_dir, ignore_errors=True)
    return merged


def compute_anchors(manifest_chars: dict):
    for char_id, char_data in manifest_chars.items():
        for phase_key, phase_data in char_data["phases"].items():
            ref_w, ref_h = _compute_phase_ref_size(phase_data)

            phase_data["refBodyHeight"] = ref_h
            phase_data["refBodyWidth"] = ref_w

            # Calcula anchorX e anchorY relativos à imagem recortada (cropOrigin)
            for action, frames in phase_data["actions"].items():
                for f in frames:
                    if "anchorX" in f and "anchorY" in f:
                        f.pop("bodyCenterX", None)
                        continue
                    by1 = f["bboxInQuad"][3]
                    cy0 = f["cropOrigin"][1]
                    fw = max(1, f["w"])
                    fh = max(1, f["h"])
                    body_cx = f.pop("bodyCenterX", fw * 0.5)
                    f["anchorX"] = round(max(fw * 0.12, min(fw * 0.88, body_cx)), 1)
                    if action.endswith("_down") or action.endswith("_diag_down"):
                        cy_mid = fh * 0.48
                        ratio = 0.45 if action.endswith("_down") else 0.48
                        min_ay = fh * (0.38 if action.endswith("_down") else 0.50)
                        max_ay = float(by1 - cy0)
                        f["anchorY"] = round(max(min_ay, min(max_ay, cy_mid + ratio * ref_h)), 1)
                    else:
                        f["anchorY"] = round(by1 - cy0, 1)

            for vfx_action, frames in phase_data["vfx"].items():
                for f in frames:
                    if "anchorX" in f and "anchorY" in f:
                        continue
                    bx0, by0, bx1, by1 = f["bboxInQuad"]
                    cx0, cy0 = f["cropOrigin"]
                    f["anchorX"] = round(((bx0 + bx1) * 0.5) - cx0, 1)
                    f["anchorY"] = round(((by0 + by1) * 0.5) - cy0, 1)


def prune_orphan_assets(manifest_chars: dict) -> int:
    """Remove arquivos .webp obsoletos e diretórios vazios fora do manifest.json."""
    valid_paths: set[Path] = set()
    for cdata in manifest_chars.values():
        for pdata in cdata["phases"].values():
            for frames in list(pdata["actions"].values()) + list(pdata["vfx"].values()):
                for f in frames:
                    valid_paths.add((ROOT / "public" / f["src"].lstrip("/")).resolve())

    removed = 0
    for root_str, _, files in os.walk(OUT_DIR):
        root_p = Path(root_str)
        for fname in files:
            fpath = (root_p / fname).resolve()
            if fname.lower().endswith(".webp") and fpath not in valid_paths:
                try:
                    fpath.unlink()
                    removed += 1
                except OSError:
                    pass

    # Limpa diretórios temporários e pastas vazias de trás para frente
    for root_str, _, _ in os.walk(OUT_DIR, topdown=False):
        root_p = Path(root_str)
        if root_p == OUT_DIR:
            continue
        if root_p.name in ("_extra_tmp", "_merge_tmp"):
            shutil.rmtree(root_p, ignore_errors=True)
            continue
        try:
            if not any(root_p.iterdir()):
                root_p.rmdir()
        except OSError:
            pass
    return removed


def generate_pwa_icons(manifest_chars: dict):
    ICONS_DIR.mkdir(parents=True, exist_ok=True)
    # Busca frame_1 do idle do personagem destaque (goku ou primeiro disponível) para compor ícone
    hero_path = None
    for cid in ("goku", "luffy", "sukuna"):
        if cid in manifest_chars:
            f1 = manifest_chars[cid]["phases"].get("fase_1", {}).get("actions", {}).get("idle", [])
            if f1:
                hero_path = ROOT / "public" / f1[0]["src"].lstrip("/")
                break

    for size, name, maskable in [
        (192, "icon-192.png", False),
        (512, "icon-512.png", False),
        (512, "icon-maskable-512.png", True),
    ]:
        canvas = Image.new("RGBA", (size, size), (9, 10, 16, 255))
        draw = ImageDraw.Draw(canvas)

        # Fundo gradiente radial simples + aro anime
        margin = int(size * (0.14 if maskable else 0.06))
        draw.ellipse(
            [margin, margin, size - margin, size - margin],
            fill=(22, 30, 56, 255),
            outline=(255, 59, 92, 255),
            width=max(4, size // 32),
        )
        inner = int(size * (0.20 if maskable else 0.12))
        draw.ellipse(
            [inner, inner, size - inner, size - inner],
            outline=(255, 184, 0, 220),
            width=max(2, size // 64),
        )

        if hero_path and hero_path.exists():
            sprite = Image.open(hero_path).convert("RGBA")
            target_h = int(size * (0.62 if maskable else 0.74))
            ratio = target_h / max(1, sprite.height)
            target_w = max(1, int(sprite.width * ratio))
            sprite_resized = sprite.resize((target_w, target_h), Image.Resampling.LANCZOS)
            px = (size - target_w) // 2
            py = int(size * (0.19 if maskable else 0.13))
            canvas.alpha_composite(sprite_resized, (px, py))

        canvas.save(ICONS_DIR / name, format="PNG")


def collect_tasks(src_dir: Path) -> list[dict]:
    """Coleta folhas de .zip e pastas soltas, priorizando 3x2 e arquivos soltos em overrides."""
    zip_files = sorted(glob.glob(str(src_dir / "**" / "*.zip"), recursive=True))
    loose_imgs = sorted(
        p
        for ext in ("*.png", "*.jpg", "*.jpeg", "*.webp")
        for p in src_dir.rglob(ext)
        if p.is_file()
    )

    if not zip_files and not loose_imgs:
        print("Nenhuma folha (.zip ou imagem) encontrada em", src_dir, file=sys.stderr)
        sys.exit(1)

    selected: dict[tuple, tuple[int, dict]] = {}

    def register(parsed: dict, priority: int):
        key = (
            parsed["char_id"],
            parsed["phase_key"],
            parsed["is_vfx"],
            parsed["action"],
            parsed["is_extra"],
        )
        prev = selected.get(key)
        if prev is None or priority >= prev[0]:
            selected[key] = (priority, parsed)

    for zp_str in zip_files:
        zp = Path(zp_str)
        rel_parts = zp.relative_to(src_dir).parts
        default_folder_char = rel_parts[0] if len(rel_parts) > 1 else zp.stem.split("_")[0]
        with zipfile.ZipFile(zp, "r") as zf:
            for name in zf.namelist():
                if name.endswith("/"):
                    continue
                name_parts = [p for p in name.replace("\\", "/").split("/") if p]
                lower_parts = [p.lower() for p in name_parts]
                folder_char = default_folder_char
                if "overrides" in lower_parts:
                    ov_idx = lower_parts.index("overrides")
                    if ov_idx + 1 < len(name_parts):
                        folder_char = name_parts[ov_idx + 1]
                parsed = parse_entry(zp, name, folder_char, is_loose=False)
                if parsed:
                    prio = 2 if parsed["layout"] == "3x2" else 0
                    register(parsed, prio)

    for img_p in loose_imgs:
        rel_parts = img_p.relative_to(src_dir).parts
        if rel_parts[0].lower() == "overrides" and len(rel_parts) >= 3:
            folder_char = rel_parts[1]
            rel_inner = "/".join(rel_parts[1:])
        else:
            folder_char = rel_parts[0] if len(rel_parts) > 1 else img_p.stem.split("_")[0]
            rel_inner = "/".join(rel_parts)
        parsed = parse_entry(img_p, str(img_p), folder_char, is_loose=True)
        if not parsed:
            # Tenta com caminho relativo caso parse_entry precise das partes após src_dir
            parsed = parse_entry(img_p, rel_inner, folder_char, is_loose=True)
            if parsed:
                parsed["internal_path"] = str(img_p)
        else:
            parsed["internal_path"] = str(img_p)
        if parsed:
            prio = 3 if parsed["layout"] == "3x2" else 1
            register(parsed, prio)

    return [item[1] for item in selected.values()]


def main():
    src_dir = find_source_dir()
    tasks = collect_tasks(src_dir)
    print(f"Encontradas {len(tasks)} folhas em {src_dir.name}. Processando em paralelo...")
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    results = []
    workers = min(8, os.cpu_count() or 4)
    with concurrent.futures.ProcessPoolExecutor(max_workers=workers) as ex:
        for res in ex.map(process_sheet_task, tasks):
            results.append(res)

    characters = {}
    extra_map: dict[tuple, dict] = {}
    for res in results:
        if res.get("is_extra"):
            extra_map[(res["char_id"], res["phase_key"], res["is_vfx"], res["action"])] = res
            continue
        cid = res["char_id"]
        if cid not in characters:
            characters[cid] = {
                "id": cid,
                "name": CHAR_DISPLAY_NAMES.get(cid, prettify_slug(cid)),
                "phases": {},
            }

        pkey = res["phase_key"]
        pnum = res["phase_num"]
        if pkey not in characters[cid]["phases"]:
            default_meta = PHASE_COLORS.get(cid, [])
            color, label = (
                default_meta[pnum - 1]
                if pnum - 1 < len(default_meta)
                else ("#38bdf8", prettify_slug(res["phase_slug"]))
            )
            characters[cid]["phases"][pkey] = {
                "phase": pnum,
                "key": pkey,
                "label": label,
                "auraColor": color,
                "moves": {},
                "actions": {},
                "vfx": {},
            }

        pdata = characters[cid]["phases"][pkey]
        if res["is_vfx"]:
            pdata["vfx"][res["action"]] = res["frames"]
        else:
            pdata["actions"][res["action"]] = res["frames"]
            if re.match(r"^ataque_[1-4]$", res["action"]):
                pdata["moves"][res["action"]] = res["move_label"]

    # Mescla eventuais tiras extras 2x1 em ações/VFX de 4 frames
    for (cid, pkey, is_vfx, action), ext in extra_map.items():
        if cid not in characters or pkey not in characters[cid]["phases"]:
            continue
        pdata = characters[cid]["phases"][pkey]
        bucket = pdata["vfx"] if is_vfx else pdata["actions"]
        base_frames = bucket.get(action, [])
        if len(base_frames) == 4:
            bucket[action] = _interleave_extra_frames(action, base_frames, ext["frames"], cid, pkey, is_vfx)

    # Ordena fases 1..4
    for cid, cdata in characters.items():
        cdata["phases"] = dict(sorted(cdata["phases"].items(), key=lambda kv: kv[1]["phase"]))

    synthesize_directional_attacks(characters, workers)
    compute_anchors(characters)
    removed_orphans = prune_orphan_assets(characters)
    generate_pwa_icons(characters)

    manifest = {
        "version": 1,
        "generatedAt": "build",
        "characters": characters,
    }
    manifest_path = OUT_DIR / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")

    total_frames = sum(
        len(frames)
        for c in characters.values()
        for p in c["phases"].values()
        for frames in list(p["actions"].values()) + list(p["vfx"].values())
    )
    print(
        f"Concluído! {len(characters)} personagens, {total_frames} quadros WebP ativos "
        f"({removed_orphans} órfãos removidos) em {OUT_DIR}"
    )


if __name__ == "__main__":
    main()
