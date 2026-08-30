# /// script
# requires-python = ">=3.11"
# dependencies = ["diagrams>=0.25,<0.26", "pillow>=11,<13"]
# ///
"""Render an icon-led ClassGame architecture with mingrammer/diagrams.

Graphviz owns the topology; this script only shapes it: nodes are compact
icon cards (icon on top, bold title, muted subtitle), clusters are quiet
rounded panels, and the finished graph is fitted below a slide header on an
exact 16:9 canvas. Nothing is stretched, so type stays readable.

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

from diagrams import Cluster, Diagram, Edge, Node
from diagrams.gcp.api import Endpoints
from diagrams.gcp.compute import Run
from diagrams.gcp.database import Firestore
from diagrams.gcp.devtools import Tasks
from diagrams.gcp.ml import AIPlatform, VertexAI
from diagrams.gcp.operations import Monitoring
from diagrams.gcp.security import Iam
from diagrams.gcp.storage import GCS
from diagrams.onprem.client import Users
from diagrams.onprem.inmemory import Redis
from diagrams.programming.flowchart import Decision, Document
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
# Slide header band (logical px). The graph is fitted into the space below it.
HEADER_HEIGHT = 112
FRAME_MARGIN_X = 48
FRAME_MARGIN_BOTTOM = 40

TITLE = "ClassGame · Production Architecture"
SUBTITLE = "Teacher intent becomes a mission with M.I.A (Multimodal Intelligence Agent)"

BLUE = "#3b63f3"
PURPLE = "#8b5cf6"
ORANGE = "#ed8b00"
TEAL = "#0ea5b7"
GREEN = "#16a368"
RED = "#dc382d"
INK = "#211833"
MUTED = "#645b73"
PANEL_FILL = "#f6f7fb"
PANEL_LINE = "#d8dce8"
SANS = "Helvetica Neue, Helvetica, Arial, sans-serif"


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

# No `ratio`/`size`: Graphviz lays the graph out at its natural density and we
# fit the result onto the slide afterwards, so spacing and type scale together.
graph_attr = {
    "bgcolor": "white",
    "dpi": "192",
    "pad": "0.3",
    "nodesep": "0.42",
    "ranksep": "1.25",
    "splines": "spline",
    "newrank": "true",
    "compound": "true",
    # Best effort only: dot keeps a node's out-edges in declaration order, but
    # heads inside different clusters may still be reordered.
    "ordering": "out",
    "fontname": "Helvetica",
}
node_attr = {
    "fontname": "Helvetica",
    "fontcolor": INK,
}
edge_attr = {
    "color": BLUE,
    "fontcolor": MUTED,
    "fontname": "Helvetica",
    "fontsize": "12.5",
    "penwidth": "1.6",
    "arrowsize": "0.75",
    "labeldistance": "1.2",
}
cluster_attr = {
    "style": "rounded,filled",
    "fillcolor": PANEL_FILL,
    "bgcolor": PANEL_FILL,
    "pencolor": PANEL_LINE,
    "penwidth": "1.2",
    "fontname": "Helvetica-Bold",
    "fontsize": "13",
    "fontcolor": MUTED,
    "labeljust": "r",
    "margin": "22",
}


def card(icon: type[Node], title: str, subtitle: str, **attrs) -> Node:
    """Icon on top, bold title, muted subtitle — one compact card per component."""
    label = (
        f'<<font point-size="16"><b>{title}</b></font>'
        f'<br/><font point-size="12" color="{MUTED}">{subtitle}</font>>'
    )
    return icon(
        label,
        width="1.45",
        height="2.0",
        fixedsize="true",
        imagescale="true",
        imagepos="tc",
        labelloc="b",
        **attrs,
    )


def panel(title: str) -> Cluster:
    return Cluster(title, graph_attr=cluster_attr)


def flow(color: str = BLUE, label: str = "", **attrs) -> Edge:
    return Edge(color=color, label=label, **attrs)


def pulse(color: str, label: str = "", **attrs) -> Edge:
    """Realtime / telemetry traffic: same weight, dashed."""
    return Edge(color=color, label=label, style="dashed", **attrs)


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
    # Both surfaces ship from the same Next.js service but stay separate
    # product experiences on the slide.
    with panel("BROWSER"):
        students = card(Users, "Students", "anonymous session")
        student_game = card(React, "3D learning game", "React · Three.js")
        teachers = card(Users, "Teachers", "Google / demo account")
        dashboard = card(React, "Teacher dashboard", "missions · live evidence")

        students >> flow(label="play", weight="3") >> student_game
        teachers >> flow(label="plan · observe", weight="3") >> dashboard

    # Cloud Run is the synchronous spine; the Go API re-verifies browser
    # identity before any tenant-scoped work.
    with panel("CLOUD RUN"):
        web = card(Run, "classgame-web", "Next.js")
        api = card(Go, "classgame-api", "Go + Echo")

        web >> flow(label="HTTPS + ID token", weight="8") >> api

    # Custom application agents (not an ADK runtime). Stacked in one column;
    # every model call funnels through the policy gate.
    with panel("AGENT RUNTIME"):
        mission = card(AIPlatform, "Mission Agent", "preview · revise · publish")
        tutor = card(AIPlatform, "Mia Tutor Agent", "RAG · memory · multi-turn")
        learning = card(AIPlatform, "Learning Agent", "trace · memory · synthesis")
        policy = card(Decision, "Policy + grounding", "validation · safe fallback")

        mission >> flow(PURPLE) >> policy
        tutor >> flow(PURPLE, label="grounded context") >> policy
        learning >> flow(PURPLE) >> policy

    with panel("GEMINI"):
        vertex = card(VertexAI, "Gemini 3.7 Flash", "structured JSON · Vertex AI")

    # Cloud Tasks only calls API-owned worker endpoints; the queue never owns
    # business state.
    with panel("ASYNC WORK + OPERATIONS"):
        cloud_tasks = card(Tasks, "Cloud Tasks", "finalize · watchdog · copy")
        task_handlers = card(Endpoints, "OIDC task handlers", "idempotent workers")
        redis = card(Redis, "Redis", "quotas · health")
        posthog = card(Monitoring, "PostHog", "analytics · exceptions")

        cloud_tasks >> flow(ORANGE, label="OIDC delivery") >> task_handlers

    with panel("FIREBASE"):
        firebase_auth = card(Iam, "Firebase Auth", "Google · password · anonymous")
        firestore = card(Firestore, "Firestore", "missions · attempts · realtime")
        storage = card(GCS, "Cloud Storage", "immutable published attachments")

    # Kept out of the operations panel: a cluster spanning many ranks would be
    # forced into its own full-width row.
    with panel("INTAKE"):
        uploadcare = card(Document, "Uploadcare", "temporary direct uploads")

    # Experience entry points.
    student_game >> flow(weight="3") >> web
    dashboard >> flow(weight="3") >> web

    # API fan-out. `minlen` pushes the leaf services to the right so no column
    # stacks more than four cards and the graph stays close to 16:9.
    api >> flow(label="preview · publish") >> mission
    api >> flow(label="answer · feedback") >> tutor
    api >> flow(label="snapshot · summarize") >> learning
    api >> flow(ORANGE, label="enqueue") >> cloud_tasks
    api >> Edge(style="invis") >> uploadcare
    # One compound edge into the Firebase panel (clipped at its border): two
    # node-level edges cannot both be straight, and the loser loops around the
    # operations panel.
    api >> flow(
        label="verify identity · read / write",
        lhead="cluster_FIREBASE",
        minlen="3",
        weight="10",
    ) >> firebase_auth
    api >> flow(RED, label="rate limits") >> redis
    api >> pulse(TEAL, label="analytics · exceptions", minlen="2") >> posthog

    # Every prompt leaves through the application-owned safety gate.
    policy >> flow(PURPLE, label="grounded prompt", weight="4") >> vertex

    # Durable background work.
    task_handlers >> flow(ORANGE, label="monotonic updates") >> firestore
    task_handlers >> flow(ORANGE, label="canonical copy") >> storage
    uploadcare >> flow(ORANGE, label="approved upload") >> task_handlers

    # The browser's direct Firestore listeners are deliberately not drawn: a
    # rank-1 → rank-6 edge can only be routed as a huge arc around every panel.
    # Firestore's subtitle carries "realtime" instead.


def frame_box(scale: int) -> tuple[int, int, int, int]:
    """Slide area reserved for the graph (left, top, right, bottom), in canvas px."""
    return (
        FRAME_MARGIN_X * scale,
        HEADER_HEIGHT * scale,
        (LOGICAL_SIZE[0] - FRAME_MARGIN_X) * scale,
        (LOGICAL_SIZE[1] - FRAME_MARGIN_BOTTOM) * scale,
    )


def write_slide_png() -> None:
    """Fit the native Graphviz render under the header on an exact 4K 16:9 canvas."""
    raw_png = RAW_OUTPUT.with_suffix(".png")
    left, top, right, bottom = frame_box(PNG_SCALE)
    frame = (right - left, bottom - top)
    with Image.open(raw_png) as source:
        fitted = ImageOps.contain(
            source.convert("RGB"), frame, method=Image.Resampling.LANCZOS
        )

    canvas = Image.new("RGB", CANVAS_SIZE, "white")
    canvas.paste(
        fitted,
        (left + (frame[0] - fitted.width) // 2, top + (frame[1] - fitted.height) // 2),
    )
    draw = ImageDraw.Draw(canvas)
    draw.text((42 * PNG_SCALE, 22 * PNG_SCALE), TITLE, fill=INK, font=FONT_TITLE)
    draw.text((44 * PNG_SCALE, 66 * PNG_SCALE), SUBTITLE, fill=MUTED, font=FONT_SUBTITLE)
    canvas.save(OUTPUT, quality=95)
    raw_png.unlink()


def svg_number(value: str) -> float:
    """Parse a Graphviz SVG dimension such as ``1208pt``."""
    return float(
        "".join(character for character in value if character.isdigit() or character in ".-")
    )


def write_portable_svg() -> None:
    """Wrap the Graphviz SVG in 16:9 under the header and inline every icon."""
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

    left, top, right, bottom = frame_box(1)
    frame_width, frame_height = right - left, bottom - top
    scale = min(frame_width / raw_width, frame_height / raw_height)
    fitted_width = raw_width * scale
    fitted_height = raw_height * scale

    raw_root.set("x", f"{left + (frame_width - fitted_width) / 2:.2f}")
    raw_root.set("y", f"{top + (frame_height - fitted_height) / 2:.2f}")
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
            "font-family": SANS,
            "font-size": "36",
            "font-weight": "700",
        },
    )
    title.text = TITLE
    subtitle = ET.SubElement(
        outer,
        f"{{{svg_namespace}}}text",
        {"x": "44", "y": "82", "fill": MUTED, "font-family": SANS, "font-size": "17"},
    )
    subtitle.text = SUBTITLE

    ET.ElementTree(outer).write(SVG_OUTPUT, encoding="utf-8", xml_declaration=True)
    raw_svg.unlink()


write_slide_png()
write_portable_svg()
print(f"Wrote {OUTPUT} ({CANVAS_SIZE[0]}x{CANVAS_SIZE[1]})")
print(f"Wrote {SVG_OUTPUT} (vector {LOGICAL_SIZE[0]}x{LOGICAL_SIZE[1]} viewBox)")
