# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow>=11,<13"]
# ///
"""Render the ClassGame production architecture as a slide-friendly PNG.

The layout is intentionally manual. It follows the visual language of the
hackathon reference diagram while keeping the ClassGame request, agent,
realtime, and background-processing paths readable on a 16:9 slide.

Run from any directory:

    uv run architecture.py

Output: architecture.png beside this file.
"""

from __future__ import annotations

import math
from pathlib import Path
from typing import TypeAlias

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "architecture.png"

WIDTH = 1920
HEIGHT = 1080

Point: TypeAlias = tuple[int, int]
Box: TypeAlias = tuple[int, int, int, int]

BACKGROUND = "#fcfbff"
WHITE = "#ffffff"
INK = "#211833"
MUTED = "#6b617b"
PANEL = "#f7f4ff"
PANEL_BORDER = "#d8ccff"
SECTION = "#fdfcff"
SECTION_BORDER = "#c8b6ff"
NODE_BORDER = "#cdbdff"

PURPLE = "#9164f9"
PURPLE_DARK = "#7546db"
BLUE = "#3b63f3"
TEAL = "#12a7b8"
ORANGE = "#ed8b00"
GREEN = "#16a368"
RED = "#e55276"
FIREBASE = "#f59e0b"
REDIS = "#d9362b"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
        if bold
        else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Helvetica Bold.ttf"
        if bold
        else "/System/Library/Fonts/Supplemental/Helvetica.ttf",
        "/Library/Fonts/Arial Bold.ttf" if bold else "/Library/Fonts/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
        if bold
        else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size=size)
    return ImageFont.load_default()


FONT_TITLE = font(36, bold=True)
FONT_SUBTITLE = font(17)
FONT_PANEL = font(20, bold=True)
FONT_PANEL_DETAIL = font(13)
FONT_SECTION = font(14, bold=True)
FONT_NODE = font(17, bold=True)
FONT_NODE_DETAIL = font(13)
FONT_EDGE = font(13, bold=True)
FONT_BADGE = font(13, bold=True)
FONT_LEGEND = font(13)


def text_size(
    draw: ImageDraw.ImageDraw,
    text: str,
    font_obj: ImageFont.ImageFont,
) -> tuple[int, int]:
    box = draw.textbbox((0, 0), text, font=font_obj)
    return box[2] - box[0], box[3] - box[1]


def rounded(
    draw: ImageDraw.ImageDraw,
    box: Box,
    fill: str,
    outline: str,
    radius: int = 18,
    width: int = 2,
) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def panel(
    draw: ImageDraw.ImageDraw,
    box: Box,
    title: str,
    detail: str,
) -> None:
    rounded(draw, box, PANEL, PANEL_BORDER, radius=24, width=2)
    draw.text((box[0] + 16, box[1] + 12), title, fill=INK, font=FONT_PANEL)
    draw.text((box[0] + 16, box[1] + 39), detail, fill=MUTED, font=FONT_PANEL_DETAIL)


def section(draw: ImageDraw.ImageDraw, box: Box, title: str) -> None:
    rounded(draw, box, SECTION, SECTION_BORDER, radius=18, width=2)
    draw.text((box[0] + 14, box[1] + 10), title, fill=INK, font=FONT_SECTION)


def pixel_wrapped_lines(
    draw: ImageDraw.ImageDraw,
    text: str,
    font_obj: ImageFont.ImageFont,
    max_width: int,
) -> list[str]:
    lines: list[str] = []
    for paragraph in text.split("\n"):
        words = paragraph.split()
        if not words:
            lines.append("")
            continue
        current = words[0]
        for word in words[1:]:
            candidate = f"{current} {word}"
            if text_size(draw, candidate, font_obj)[0] <= max_width:
                current = candidate
            else:
                lines.append(current)
                current = word
        lines.append(current)
    return lines


def centered_lines(
    draw: ImageDraw.ImageDraw,
    box: Box,
    lines: list[str],
    font_obj: ImageFont.ImageFont,
    fill: str,
    gap: int = 4,
) -> None:
    heights = [text_size(draw, line, font_obj)[1] for line in lines]
    total_height = sum(heights) + max(len(lines) - 1, 0) * gap
    y = box[1] + ((box[3] - box[1]) - total_height) / 2
    for line, line_height in zip(lines, heights):
        line_width, _ = text_size(draw, line, font_obj)
        x = box[0] + ((box[2] - box[0]) - line_width) / 2
        draw.text((x, y), line, fill=fill, font=font_obj)
        y += line_height + gap


def node(
    draw: ImageDraw.ImageDraw,
    box: Box,
    title: str,
    detail: str,
    badge: str,
    badge_fill: str,
    icon: str | None = None,
) -> None:
    rounded(draw, box, WHITE, NODE_BORDER, radius=16, width=2)
    cx = box[0] + 47
    cy = box[1] + (box[3] - box[1]) // 2

    if icon == "react":
        react_logo(draw, cx, cy)
    elif icon == "gemini":
        gemini_logo(draw, cx, cy)
    else:
        draw.ellipse((cx - 27, cy - 27, cx + 27, cy + 27), fill=badge_fill)
        badge_width, badge_height = text_size(draw, badge, FONT_BADGE)
        draw.text(
            (cx - badge_width / 2, cy - badge_height / 2 - 1),
            badge,
            fill=WHITE,
            font=FONT_BADGE,
        )

    text_box = (box[0] + 82, box[1] + 9, box[2] - 10, box[3] - 9)
    max_text_width = text_box[2] - text_box[0]
    title_lines = pixel_wrapped_lines(draw, title, FONT_NODE, max_text_width)
    detail_lines = (
        pixel_wrapped_lines(draw, detail, FONT_NODE_DETAIL, max_text_width)
        if detail
        else []
    )
    title_heights = [text_size(draw, line, FONT_NODE)[1] for line in title_lines]
    detail_heights = [text_size(draw, line, FONT_NODE_DETAIL)[1] for line in detail_lines]
    total_height = (
        sum(title_heights)
        + max(len(title_lines) - 1, 0) * 3
        + (7 if detail_lines else 0)
        + sum(detail_heights)
        + max(len(detail_lines) - 1, 0) * 2
    )
    y = text_box[1] + ((text_box[3] - text_box[1]) - total_height) / 2
    for line, line_height in zip(title_lines, title_heights):
        line_width, _ = text_size(draw, line, FONT_NODE)
        x = text_box[0] + ((text_box[2] - text_box[0]) - line_width) / 2
        draw.text((x, y), line, fill=INK, font=FONT_NODE)
        y += line_height + 3
    if detail_lines:
        y += 4
    for line, line_height in zip(detail_lines, detail_heights):
        line_width, _ = text_size(draw, line, FONT_NODE_DETAIL)
        x = text_box[0] + ((text_box[2] - text_box[0]) - line_width) / 2
        draw.text((x, y), line, fill=MUTED, font=FONT_NODE_DETAIL)
        y += line_height + 2


def ribbon(
    draw: ImageDraw.ImageDraw,
    box: Box,
    title: str,
    detail: str,
    color: str,
) -> None:
    rounded(draw, box, WHITE, NODE_BORDER, radius=14, width=2)
    draw.rounded_rectangle(
        (box[0] + 12, box[1] + 13, box[0] + 20, box[3] - 13),
        radius=4,
        fill=color,
    )
    draw.text((box[0] + 32, box[1] + 13), title, fill=INK, font=FONT_NODE)
    draw.text((box[0] + 32, box[1] + 39), detail, fill=MUTED, font=FONT_NODE_DETAIL)


def react_logo(draw: ImageDraw.ImageDraw, cx: int, cy: int) -> None:
    color = "#35bfe8"
    for angle in (0, 60, 120):
        draw.line(rotated_ellipse(cx, cy, 34, 11, angle), fill=color, width=4, joint="curve")
    draw.ellipse((cx - 7, cy - 7, cx + 7, cy + 7), fill=color)


def gemini_logo(draw: ImageDraw.ImageDraw, cx: int, cy: int) -> None:
    radius = 29
    points = [
        (cx, cy - radius),
        (cx + 8, cy - 8),
        (cx + radius, cy),
        (cx + 8, cy + 8),
        (cx, cy + radius),
        (cx - 8, cy + 8),
        (cx - radius, cy),
        (cx - 8, cy - 8),
    ]
    draw.polygon(points, fill=PURPLE)
    draw.ellipse((cx - 6, cy - 6, cx + 6, cy + 6), fill=WHITE)


def rotated_ellipse(
    cx: int,
    cy: int,
    rx: int,
    ry: int,
    angle_degrees: int,
) -> list[Point]:
    angle = math.radians(angle_degrees)
    cos_angle = math.cos(angle)
    sin_angle = math.sin(angle)
    points: list[Point] = []
    for index in range(73):
        theta = 2 * math.pi * index / 72
        x = rx * math.cos(theta)
        y = ry * math.sin(theta)
        points.append(
            (
                round(cx + x * cos_angle - y * sin_angle),
                round(cy + x * sin_angle + y * cos_angle),
            )
        )
    return points


def dashed_line(
    draw: ImageDraw.ImageDraw,
    start: Point,
    end: Point,
    color: str,
    width: int,
    dash: int = 11,
    gap: int = 7,
) -> None:
    x1, y1 = start
    x2, y2 = end
    dx = x2 - x1
    dy = y2 - y1
    length = max(math.hypot(dx, dy), 1)
    unit_x = dx / length
    unit_y = dy / length
    position = 0.0
    while position < length:
        segment_end = min(position + dash, length)
        draw.line(
            (
                (x1 + unit_x * position, y1 + unit_y * position),
                (x1 + unit_x * segment_end, y1 + unit_y * segment_end),
            ),
            fill=color,
            width=width,
        )
        position += dash + gap


def arrow_head(draw: ImageDraw.ImageDraw, start: Point, end: Point, color: str) -> None:
    x1, y1 = start
    x2, y2 = end
    if abs(x2 - x1) >= abs(y2 - y1):
        direction = 1 if x2 >= x1 else -1
        points = [
            (x2, y2),
            (x2 - direction * 14, y2 - 8),
            (x2 - direction * 14, y2 + 8),
        ]
    else:
        direction = 1 if y2 >= y1 else -1
        points = [
            (x2, y2),
            (x2 - 8, y2 - direction * 14),
            (x2 + 8, y2 - direction * 14),
        ]
    draw.polygon(points, fill=color)


def edge_label(draw: ImageDraw.ImageDraw, anchor: Point, text: str) -> None:
    lines = text.split("\n")
    widths = [text_size(draw, line, FONT_EDGE)[0] for line in lines]
    heights = [text_size(draw, line, FONT_EDGE)[1] for line in lines]
    box_width = max(widths) + 18
    box_height = sum(heights) + max(len(lines) - 1, 0) * 2 + 10
    box = (
        anchor[0] - box_width // 2,
        anchor[1] - box_height // 2,
        anchor[0] + box_width // 2,
        anchor[1] + box_height // 2,
    )
    rounded(draw, box, WHITE, WHITE, radius=8, width=1)
    y = box[1] + 5
    for line, line_height in zip(lines, heights):
        line_width, _ = text_size(draw, line, FONT_EDGE)
        draw.text((anchor[0] - line_width / 2, y), line, fill=MUTED, font=FONT_EDGE)
        y += line_height + 2


def arrow(
    draw: ImageDraw.ImageDraw,
    points: list[Point],
    *,
    color: str = BLUE,
    width: int = 4,
    dashed: bool = False,
    label: str = "",
    label_at: Point | None = None,
) -> None:
    for start, end in zip(points, points[1:]):
        if dashed:
            dashed_line(draw, start, end, color, width)
        else:
            draw.line((start, end), fill=color, width=width)
    arrow_head(draw, points[-2], points[-1], color)
    if label and label_at:
        edge_label(draw, label_at, label)


def legend_item(
    draw: ImageDraw.ImageDraw,
    x: int,
    y: int,
    text: str,
    color: str,
    dashed: bool = False,
) -> int:
    start = (x, y + 8)
    end = (x + 52, y + 8)
    if dashed:
        dashed_line(draw, start, end, color, 4, dash=9, gap=6)
    else:
        draw.line((start, end), fill=color, width=4)
    arrow_head(draw, start, end, color)
    draw.text((x + 64, y), text, fill=MUTED, font=FONT_LEGEND)
    text_width, _ = text_size(draw, text, FONT_LEGEND)
    return x + 64 + text_width + 42


def main() -> None:
    image = Image.new("RGB", (WIDTH, HEIGHT), BACKGROUND)
    draw = ImageDraw.Draw(image)

    draw.text((42, 22), "ClassGame · Production Architecture", fill=INK, font=FONT_TITLE)
    draw.text(
        (44, 66),
        "Teacher intent becomes a mission with M.I.A (Multimodal Intelligence Agent",
        fill=MUTED,
        font=FONT_SUBTITLE,
    )

    experience = (40, 105, 455, 990)
    application = (485, 105, 1005, 990)
    services = (1035, 105, 1455, 990)
    data = (1485, 105, 1880, 990)

    panel(draw, experience, "Web Experiences", "classgame-web · Next.js on Cloud Run")
    panel(draw, application, "Application + Agent Runtime", "classgame-api · Go + Echo on Cloud Run")
    panel(draw, services, "Managed Services", "AI generation · async work · operations")
    panel(draw, data, "Identity + Persistent Data", "Firebase platform · teacher content")

    student_section = (65, 165, 430, 470)
    teacher_section = (65, 515, 430, 820)
    api_section = (510, 165, 980, 950)
    vertex_section = (1060, 165, 1430, 455)
    operations_section = (1060, 500, 1430, 950)
    firebase_section = (1510, 165, 1855, 690)
    content_section = (1510, 735, 1855, 920)

    section(draw, student_section, "Student Experience")
    section(draw, teacher_section, "Teacher Experience")
    section(draw, api_section, "Server-owned context, policy, and orchestration")
    section(draw, vertex_section, "Vertex AI · Google Gen AI SDK for Go")
    section(draw, operations_section, "Async + Operations")
    section(draw, firebase_section, "Firebase Platform")
    section(draw, content_section, "Attachment Intake")

    # Node geometry.
    students = (105, 205, 390, 275)
    game = (105, 320, 390, 430)
    teachers = (105, 555, 390, 625)
    dashboard = (105, 675, 390, 785)
    realtime = (105, 865, 390, 945)

    ingress = (555, 205, 940, 290)
    mission_agent = (535, 355, 745, 455)
    tutor_agent = (765, 355, 955, 455)
    learning_agent = (535, 530, 955, 630)
    policy = (535, 705, 745, 805)
    task_handlers = (765, 705, 955, 805)
    repositories = (555, 855, 935, 925)

    gemini = (1090, 210, 1400, 325)
    fallbacks = (1090, 355, 1400, 430)
    cloud_tasks = (1090, 550, 1400, 650)
    redis = (1090, 690, 1400, 790)
    posthog = (1090, 830, 1400, 930)

    firebase_auth = (1540, 210, 1825, 295)
    firestore = (1540, 345, 1825, 475)
    cloud_storage = (1540, 535, 1825, 625)
    uploadcare = (1540, 790, 1825, 880)

    # Web and API request paths.
    arrow(draw, [(247, 275), (247, 320)], color=BLUE)
    arrow(draw, [(247, 625), (247, 675)], color=BLUE)
    arrow(
        draw,
        [(390, 365), (470, 365), (470, 225), (555, 225)],
        color=BLUE,
        label="HTTPS\nanonymous ID token",
        label_at=(470, 300),
    )
    arrow(
        draw,
        [(390, 730), (470, 730), (470, 270), (555, 270)],
        color=BLUE,
        label="HTTPS\nGoogle ID token",
        label_at=(470, 620),
    )

    # API ingress dispatches server-owned agent operations.
    arrow(draw, [(640, 290), (640, 355)], color=BLUE)
    arrow(draw, [(850, 290), (850, 355)], color=BLUE)
    arrow(draw, [(745, 455), (745, 490), (745, 530)], color=BLUE)
    arrow(draw, [(855, 455), (855, 530)], color=BLUE)

    # Gemini structured generation paths.
    arrow(
        draw,
        [(745, 395), (1015, 395), (1015, 245), (1090, 245)],
        color=PURPLE,
    )
    arrow(
        draw,
        [(955, 405), (1028, 405), (1028, 285), (1090, 285)],
        color=PURPLE,
    )
    arrow(
        draw,
        [(955, 580), (1045, 580), (1045, 315), (1090, 315)],
        color=PURPLE,
    )

    # Identity verification and server-owned persistence.
    arrow(
        draw,
        [(940, 225), (1018, 225), (1018, 95), (1470, 95), (1470, 252), (1540, 252)],
        color=GREEN,
    )
    arrow(draw, [(640, 805), (640, 855)], color=BLUE)
    arrow(draw, [(860, 805), (860, 855)], color=BLUE)
    arrow(
        draw,
        [(935, 890), (1018, 890), (1018, 962), (1470, 962), (1470, 410), (1540, 410)],
        color=BLUE,
        label="missions · attempts · memory · summaries",
        label_at=(1260, 962),
    )

    # Realtime browser projections return without exposing private traces.
    arrow(
        draw,
        [(1825, 445), (1860, 445), (1860, 1000), (247, 1000), (247, 945)],
        color=TEAL,
        dashed=True,
        label="student-safe mission catalog + teacher class updates",
        label_at=(810, 1000),
    )
    arrow(draw, [(190, 865), (190, 810), (247, 810), (247, 785)], color=TEAL, dashed=True)
    arrow(draw, [(305, 865), (305, 835), (365, 835), (365, 430)], color=TEAL, dashed=True)

    # Background learning and attachment work.
    arrow(
        draw,
        [(955, 600), (1090, 600)],
        color=ORANGE,
        label="complete / paused",
        label_at=(1022, 600),
    )
    arrow(
        draw,
        [(1090, 635), (1020, 635), (1020, 755), (955, 755)],
        color=ORANGE,
    )
    arrow(
        draw,
        [(955, 780), (1018, 780), (1018, 675), (1470, 675), (1470, 580), (1540, 580)],
        color=ORANGE,
        label="canonical attachment copy",
        label_at=(1260, 675),
    )
    arrow(
        draw,
        [(1540, 835), (1470, 835), (1470, 940), (870, 940), (870, 805)],
        color=ORANGE,
        label="stream approved upload",
        label_at=(1260, 940),
    )

    # Distributed quotas and product observability.
    arrow(
        draw,
        [(940, 270), (995, 270), (995, 740), (1090, 740)],
        color=REDIS,
    )
    arrow(
        draw,
        [(940, 250), (1010, 250), (1010, 880), (1090, 880)],
        color=TEAL,
        dashed=True,
        label="events + exceptions",
        label_at=(1010, 835),
    )

    # Draw nodes last so crossing lines stay behind cards.
    node(draw, students, "Students", "anonymous Firebase session", "STU", PURPLE)
    node(draw, game, "3D Learning Game", "Next.js · React · Three.js", "R", TEAL, icon="react")
    node(draw, teachers, "Teachers", "Google or demo account", "T", BLUE)
    node(draw, dashboard, "Teacher Dashboard", "missions · live evidence · plans", "R", TEAL, icon="react")
    ribbon(draw, realtime, "Firestore Realtime", "mission catalog · class listeners", TEAL)

    node(draw, ingress, "REST API + Auth", "tenant scope · validation · rate limits", "GO", PURPLE_DARK)
    node(draw, mission_agent, "Mission Agent", "preview · revise · publish", "M", PURPLE)
    node(draw, tutor_agent, "Tutor Agent", "RAG · memory · multi-turn", "MIA", PURPLE)
    node(
        draw,
        learning_agent,
        "Learning Agent",
        "observable trace · persistent memory · class synthesis",
        "AI",
        PURPLE,
    )
    node(draw, policy, "Policy + Grounding", "server truth · leak guard · fallbacks", "SAFE", GREEN)
    node(draw, task_handlers, "Task Handlers", "OIDC · idempotent workers", "W", ORANGE)
    ribbon(draw, repositories, "Firestore Repositories", "monotonic snapshots · immutable revisions", BLUE)

    node(
        draw,
        gemini,
        "Gemini 3.7 Flash",
        "missions · tutor · learning trace · class synthesis\nstructured JSON via Vertex AI",
        "G",
        PURPLE,
        icon="gemini",
    )
    ribbon(draw, fallbacks, "Safety + Fallbacks", "education policy · deterministic continuity", GREEN)
    node(draw, cloud_tasks, "Cloud Tasks", "finalize · watchdog · attachment copy", "Q", ORANGE)
    node(draw, redis, "Redis", "distributed generation quotas + health", "R", REDIS)
    node(draw, posthog, "PostHog", "web + API analytics and exceptions", "PH", RED)

    node(draw, firebase_auth, "Firebase Auth", "Google · password · anonymous", "AUTH", FIREBASE)
    node(
        draw,
        firestore,
        "Firestore",
        "missions · attempts · tutor turns · memory · class summaries",
        "FS",
        FIREBASE,
    )
    node(draw, cloud_storage, "Cloud Storage", "immutable published attachments", "GCS", BLUE)
    node(draw, uploadcare, "Uploadcare", "direct temporary teacher uploads", "UP", TEAL)

    # Legend.
    legend_x = 430
    legend_y = 1028
    legend_x = legend_item(draw, legend_x, legend_y, "Synchronous HTTPS / data", BLUE)
    legend_x = legend_item(draw, legend_x, legend_y, "Gemini reasoning", PURPLE)
    legend_x = legend_item(draw, legend_x, legend_y, "Cloud Tasks", ORANGE)
    legend_item(draw, legend_x, legend_y, "Realtime / telemetry", TEAL, dashed=True)

    image.save(OUTPUT, quality=95)
    print(f"Wrote {OUTPUT} ({WIDTH}x{HEIGHT})")


if __name__ == "__main__":
    main()
