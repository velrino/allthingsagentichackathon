# /// script
# requires-python = ">=3.11"
# dependencies = ["diagrams>=0.25,<0.26", "pillow>=11,<13"]
# ///
"""Render an alternate ClassGame architecture with mingrammer/diagrams.

This version intentionally follows the compact, icon-led Graphviz language of
``portfolio-front/diagrams/wpp.py``.  It complements the hand-laid-out 16:9
diagram in ``architecture.py``; it does not replace it.

Run from any directory:

    uv run architecture_graphviz.py

Outputs beside this file:

- architecture-graphviz.png — 4K raster image.
- architecture-graphviz.svg — self-contained vector image.
"""

import base64
import mimetypes
from pathlib import Path
import xml.etree.ElementTree as ET

from diagrams import Cluster, Diagram, Edge
from diagrams.gcp.compute import Run
from diagrams.gcp.database import Firestore
from diagrams.gcp.devtools import Tasks
from diagrams.gcp.ml import VertexAI
from diagrams.gcp.security import Iam
from diagrams.gcp.storage import GCS
from diagrams.generic.storage import Storage
from diagrams.onprem.client import Users
from diagrams.onprem.inmemory import Redis
from diagrams.programming.flowchart import Decision, PredefinedProcess
from diagrams.programming.framework import React
from diagrams.programming.language import Go
from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parent
RAW_OUTPUT = ROOT / "architecture-graphviz-raw"
OUTPUT = ROOT / "architecture-graphviz.png"
SVG_OUTPUT = ROOT / "architecture-graphviz.svg"
LOGICAL_SIZE = (1920, 1080)
PNG_SCALE = 2
CANVAS_SIZE = tuple(dimension * PNG_SCALE for dimension in LOGICAL_SIZE)

BLUE = "#3b63f3"
PURPLE = "#8b5cf6"
ORANGE = "#ed8b00"
TEAL = "#0ea5b7"
GREEN = "#16a368"
RED = "#dc382d"
INK = "#211833"
MUTED = "#645b73"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    """Load the same title fonts used by the hand-laid-out architecture."""
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


FONT_TITLE = font(36 * PNG_SCALE, bold=True)
FONT_SUBTITLE = font(17 * PNG_SCALE)

graph_attr = {
    "bgcolor": "white",
    "dpi": str(120 * PNG_SCALE),
    "pad": "0.65",
    "ratio": "fill",
    "size": "16,9!",
    "nodesep": "0.5",
    "ranksep": "1.7",
    "splines": "ortho",
    "fontname": "Arial",
    "fontsize": "22",
    "compound": "true",
}
node_attr = {
    "fontname": "Arial",
    "fontsize": "16",
}
edge_attr = {
    "color": BLUE,
    "fontcolor": MUTED,
    "fontname": "Arial",
    "fontsize": "14",
    "penwidth": "2.4",
    "arrowsize": "0.9",
}


with Diagram(
    "",
    filename=str(RAW_OUTPUT),
    direction="LR",
    show=False,
    outformat=["png", "svg"],
    graph_attr=graph_attr,
    node_attr=node_attr,
    edge_attr=edge_attr,
):
    # Browser-facing experiences. Both are delivered by the same Next.js
    # service, but remain separate product surfaces in the diagram.
    with Cluster("Web experiences"):
        students = Users("Students\nanonymous session")
        student_game = React("3D learning game\nReact · Three.js")
        teachers = Users("Teachers\nGoogle / demo account")
        dashboard = React("Teacher dashboard\nmissions · live evidence")

        students >> Edge(color=BLUE, label="play") >> student_game
        teachers >> Edge(color=BLUE, label="plan / observe") >> dashboard

    # Cloud Run is the synchronous spine. Browser identity is verified again
    # by the Go API before tenant-scoped work is dispatched.
    with Cluster("Cloud Run application"):
        web = Run("classgame-web\nNext.js")
        api = Go("classgame-api\nGo + Echo")

        web >> Edge(color=BLUE, label="HTTPS + ID token") >> api

    # These are custom application agents, not an ADK runtime. The policy gate
    # keeps prompts grounded in server-owned mission and learning state.
    with Cluster("Agent runtime"):
        mission = PredefinedProcess("Mission Agent\npreview · revise · publish")
        tutor = PredefinedProcess("Mia Tutor Agent\nRAG · memory · multi-turn")
        learning = PredefinedProcess("Learning Agent\ntrace · memory · synthesis")
        policy = Decision("Policy + grounding\nvalidation · safe fallback")

        # Invisible ordering produces the horizontal cluster treatment used by
        # the WPP reference without implying another business flow.
        mission >> Edge(style="invis") >> tutor
        tutor >> Edge(style="invis") >> learning
        learning >> Edge(color=PURPLE, label="grounded context") >> policy
        mission >> Edge(color=PURPLE, constraint="false") >> policy
        tutor >> Edge(color=PURPLE, constraint="false") >> policy

    with Cluster("AI generation"):
        vertex = VertexAI("Gemini 3.7 Flash\nstructured JSON via Vertex AI")

    with Cluster("Async + operations"):
        cloud_tasks = Tasks("Cloud Tasks\nfinalize · watchdog · copy")
        task_handlers = PredefinedProcess("OIDC task handlers\nidempotent workers")
        redis = Redis("Redis\ndistributed quotas + health")

        cloud_tasks >> Edge(color=ORANGE, label="OIDC delivery") >> task_handlers
        task_handlers >> Edge(style="invis") >> redis

    with Cluster("Firebase platform"):
        firebase_auth = Iam("Firebase Auth\nGoogle · password · anonymous")
        firestore = Firestore("Firestore\nmissions · attempts · memory")
        storage = GCS("Cloud Storage\nimmutable published attachments")

        firebase_auth >> Edge(style="invis") >> firestore
        firestore >> Edge(style="invis") >> storage

    with Cluster("Telemetry + attachment intake"):
        posthog = PredefinedProcess("PostHog\nanalytics · exceptions")
        uploadcare = Storage("Uploadcare\ntemporary direct uploads")

        uploadcare >> Edge(style="invis") >> posthog

    # Experience entry points.
    student_game >> Edge(color=BLUE, label="student routes") >> web
    dashboard >> Edge(color=BLUE, label="teacher routes") >> web

    # Authentication, persistence, and synchronous orchestration.
    api >> Edge(color=GREEN, label="verify identity") >> firebase_auth
    api >> Edge(color=BLUE, label="preview / publish") >> mission
    api >> Edge(color=BLUE, label="answer / feedback") >> tutor
    api >> Edge(color=BLUE, label="snapshot / summarize") >> learning
    api >> Edge(color=BLUE, label="read / write") >> firestore
    api >> Edge(color=RED, label="rate limits") >> redis

    # All model calls pass the application-owned safety and grounding gate.
    policy >> Edge(color=PURPLE, label="grounded prompt") >> vertex

    # Durable background work. Cloud Tasks calls API-owned worker endpoints;
    # the queue never owns business state.
    api >> Edge(color=ORANGE, label="enqueue") >> cloud_tasks
    task_handlers >> Edge(color=ORANGE, label="monotonic updates") >> firestore
    task_handlers >> Edge(color=ORANGE, label="canonical copy") >> storage
    uploadcare >> Edge(color=ORANGE, label="approved upload") >> task_handlers

    # Browser-safe Firestore projections and product telemetry. The listener
    # edge points left-to-right to keep Graphviz from wrapping a reverse edge
    # around the entire composition.
    web >> Edge(
        color=TEAL,
        style="dashed",
        label="Firestore realtime listeners",
    ) >> firestore
    api >> Edge(
        color=TEAL,
        style="dashed",
        label="web + API analytics / exceptions",
    ) >> posthog


# Graphviz controls topology well but may return a canvas a few pixels narrower
# than the requested ratio. Fit the native render onto an exact 4K 16:9 canvas
# so icons and typography retain their proportions.
raw_png = RAW_OUTPUT.with_suffix(".png")
with Image.open(raw_png) as source:
    fitted = ImageOps.contain(
        source.convert("RGB"),
        CANVAS_SIZE,
        method=Image.Resampling.LANCZOS,
    )
canvas = Image.new("RGB", CANVAS_SIZE, "white")
canvas.paste(
    fitted,
    (
        # Preserve the original header's full subtitle in the empty top-left
        # area without covering the Agent runtime cluster.
        (CANVAS_SIZE[0] - fitted.width) // 2 + 40 * PNG_SCALE,
        (CANVAS_SIZE[1] - fitted.height) // 2,
    ),
)
draw = ImageDraw.Draw(canvas)
draw.text(
    (42 * PNG_SCALE, 22 * PNG_SCALE),
    "ClassGame · Production Architecture",
    fill=INK,
    font=FONT_TITLE,
)
draw.text(
    (44 * PNG_SCALE, 66 * PNG_SCALE),
    "Teacher intent becomes a mission with M.I.A (Multimodal Intelligence Agent",
    fill=MUTED,
    font=FONT_SUBTITLE,
)
canvas.save(OUTPUT, quality=95)
raw_png.unlink()


def svg_number(value: str) -> float:
    """Parse a Graphviz SVG dimension such as ``1208pt``."""
    return float("".join(character for character in value if character.isdigit() or character in ".-"))


def write_portable_svg() -> None:
    """Wrap the Graphviz SVG in 16:9 and inline every icon as a data URI."""
    raw_svg = RAW_OUTPUT.with_suffix(".svg")
    raw_root = ET.parse(raw_svg).getroot()
    svg_namespace = "http://www.w3.org/2000/svg"
    xlink_namespace = "http://www.w3.org/1999/xlink"
    ET.register_namespace("", svg_namespace)
    ET.register_namespace("xlink", xlink_namespace)

    for image in raw_root.iter(f"{{{svg_namespace}}}image"):
        href_key = f"{{{xlink_namespace}}}href"
        href = image.get(href_key) or image.get("href")
        if not href or href.startswith("data:"):
            continue
        icon_path = Path(href)
        if not icon_path.exists():
            continue
        mime_type = mimetypes.guess_type(icon_path.name)[0] or "image/png"
        encoded = base64.b64encode(icon_path.read_bytes()).decode("ascii")
        image.set(href_key, f"data:{mime_type};base64,{encoded}")
        image.attrib.pop("href", None)

    view_box = raw_root.get("viewBox")
    if view_box:
        _, _, raw_width, raw_height = map(float, view_box.split())
    else:
        raw_width = svg_number(raw_root.get("width", "1920"))
        raw_height = svg_number(raw_root.get("height", "1080"))

    scale = min(LOGICAL_SIZE[0] / raw_width, LOGICAL_SIZE[1] / raw_height)
    fitted_width = raw_width * scale
    fitted_height = raw_height * scale
    fitted_x = (LOGICAL_SIZE[0] - fitted_width) / 2 + 40
    fitted_y = (LOGICAL_SIZE[1] - fitted_height) / 2

    raw_root.set("x", f"{fitted_x:.2f}")
    raw_root.set("y", f"{fitted_y:.2f}")
    raw_root.set("width", f"{fitted_width:.2f}")
    raw_root.set("height", f"{fitted_height:.2f}")
    raw_root.set("preserveAspectRatio", "xMidYMid meet")

    outer = ET.Element(
        f"{{{svg_namespace}}}svg",
        {
            "width": str(LOGICAL_SIZE[0]),
            "height": str(LOGICAL_SIZE[1]),
            "viewBox": f"0 0 {LOGICAL_SIZE[0]} {LOGICAL_SIZE[1]}",
            "role": "img",
            "aria-label": "ClassGame production architecture",
        },
    )
    ET.SubElement(
        outer,
        f"{{{svg_namespace}}}rect",
        {"width": "100%", "height": "100%", "fill": "white"},
    )
    outer.append(raw_root)

    title = ET.SubElement(
        outer,
        f"{{{svg_namespace}}}text",
        {
            "x": "42",
            "y": "55",
            "fill": INK,
            "font-family": "Arial, Helvetica, sans-serif",
            "font-size": "36",
            "font-weight": "700",
        },
    )
    title.text = "ClassGame · Production Architecture"
    subtitle = ET.SubElement(
        outer,
        f"{{{svg_namespace}}}text",
        {
            "x": "44",
            "y": "82",
            "fill": MUTED,
            "font-family": "Arial, Helvetica, sans-serif",
            "font-size": "17",
        },
    )
    subtitle.text = "Teacher intent becomes a mission with M.I.A (Multimodal Intelligence Agent"

    ET.ElementTree(outer).write(SVG_OUTPUT, encoding="utf-8", xml_declaration=True)
    raw_svg.unlink()


write_portable_svg()
print(f"Wrote {OUTPUT} ({CANVAS_SIZE[0]}x{CANVAS_SIZE[1]})")
print(f"Wrote {SVG_OUTPUT} (vector {LOGICAL_SIZE[0]}x{LOGICAL_SIZE[1]} viewBox)")
