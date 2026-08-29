"use client";

import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import { LoaderCircle } from "lucide-react";
import { useMemo, type CSSProperties, type ReactNode } from "react";

import type {
  IApiMissionFlow,
  IApiMissionFlowNode,
} from "@/backend/api/api.interface";
import { cn } from "@/lib/utils";

type MissionFlowPendingNode = {
  readonly label: string;
  readonly description: string;
};

type MissionFlowPreviewProps = {
  /** Overrides the canvas box (default 560px tall) — e.g. `h-auto flex-1` to fill a flex column. */
  readonly className?: string;
  readonly emptyMessage?: string;
  readonly flow?: IApiMissionFlow | null;
  /** Appends a spinner node after the last node, for paths still being recorded. */
  readonly pending?: MissionFlowPendingNode;
};

type MissionReactFlowNode = Node<{ label: ReactNode }>;

const pendingNodeId = "flow-pending";

/** Backend spacing between stacked nodes (before nodePositionScale is applied). */
const stackedNodeGap = 135;

const nodeBaseStyle: CSSProperties = {
  borderRadius: 14,
  boxShadow: "0 12px 28px rgba(15, 23, 42, 0.16)",
  fontFamily: "var(--font-geist-sans)",
  padding: 0,
  width: 215,
};

const nodePositionScale = {
  x: 1.55,
  y: 1.45,
};

const nodeStyles: Record<string, CSSProperties> = {
  start: {
    ...nodeBaseStyle,
    background: "var(--primary)",
    border: "1px solid var(--primary)",
    color: "var(--primary-foreground)",
  },
  setup: {
    ...nodeBaseStyle,
    background: "#eff6ff",
    border: "1px solid #93c5fd",
  },
  activity: {
    ...nodeBaseStyle,
    background: "#ffffff",
    border: "1px solid #cbd5e1",
  },
  question: {
    ...nodeBaseStyle,
    background: "#fefce8",
    border: "1px solid #fde68a",
  },
  decision: {
    ...nodeBaseStyle,
    background: "#fff7ed",
    border: "1px solid #fdba74",
  },
  feedback: {
    ...nodeBaseStyle,
    background: "#f0fdf4",
    border: "1px solid #86efac",
  },
  answer: {
    ...nodeBaseStyle,
    background: "#eff6ff",
    border: "1px solid #93c5fd",
  },
  misconception: {
    ...nodeBaseStyle,
    background: "#fff7ed",
    border: "1px solid #fb923c",
  },
  adaptation: {
    ...nodeBaseStyle,
    background: "#faf5ff",
    border: "1px solid #c084fc",
  },
  mastery: {
    ...nodeBaseStyle,
    background: "#ecfdf5",
    border: "1px solid #34d399",
  },
  complete: {
    ...nodeBaseStyle,
    background: "#ecfdf5",
    border: "1px solid #6ee7b7",
  },
  guardrail: {
    ...nodeBaseStyle,
    background: "#fff1f2",
    border: "1px solid #fda4af",
  },
};

/** Background/border/text colors for a node kind, so legends outside the canvas match the cards inside it. */
export function getMissionFlowKindStyle(kind: string): CSSProperties {
  const { background, border, color } = nodeStyles[kind] ?? nodeStyles.activity;
  return { background, border, color };
}

export function MissionFlowPreview({
  className,
  emptyMessage = "Generate a preview to see Mia's mission flow.",
  flow,
  pending,
}: MissionFlowPreviewProps) {
  const pendingLabel = pending?.label;
  const pendingDescription = pending?.description;
  const { nodes, edges } = useMemo(
    () =>
      buildReactFlow(
        flow,
        pendingLabel
          ? { label: pendingLabel, description: pendingDescription ?? "" }
          : undefined,
      ),
    [flow, pendingLabel, pendingDescription],
  );

  if (nodes.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm leading-6 text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "h-[560px] overflow-hidden rounded-md border border-border bg-slate-50",
        className,
      )}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.32 }}
        nodesConnectable={false}
        nodesDraggable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#cbd5e1" gap={22} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

function buildReactFlow(
  flow: IApiMissionFlow | null | undefined,
  pending: MissionFlowPendingNode | undefined,
): {
  nodes: MissionReactFlowNode[];
  edges: Edge[];
} {
  const flowNodes = Array.isArray(flow?.nodes) ? flow.nodes : [];
  if (flowNodes.length === 0 && !pending) {
    return { nodes: [], edges: [] };
  }

  const nodes = flowNodes.map<MissionReactFlowNode>((node) => ({
    id: node.id,
    type: "default",
    position: {
      x: node.position.x * nodePositionScale.x,
      y: node.position.y * nodePositionScale.y,
    },
    data: {
      label: <MissionFlowNodeCard node={node} />,
    },
    style: nodeStyles[node.kind] ?? nodeStyles.activity,
  }));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const flowEdges = Array.isArray(flow?.edges) ? flow.edges : [];
  const edges = flowEdges
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .map<Edge>((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label || undefined,
      type: "smoothstep",
      animated: edge.label.toLowerCase().includes("support"),
      style: { stroke: "#94a3b8", strokeWidth: 1.5 },
      labelStyle: {
        fill: "#475569",
        fontSize: 11,
        fontWeight: 700,
      },
      labelBgStyle: { fill: "#f8fafc", fillOpacity: 0.9 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" },
    }));

  if (pending) {
    const anchor = flowNodes.reduce<IApiMissionFlowNode | null>(
      (lowest, node) =>
        lowest && lowest.position.y >= node.position.y ? lowest : node,
      null,
    );
    nodes.push({
      id: pendingNodeId,
      type: "default",
      position: {
        x: (anchor?.position.x ?? 0) * nodePositionScale.x,
        y: ((anchor?.position.y ?? -stackedNodeGap) + stackedNodeGap) * nodePositionScale.y,
      },
      data: { label: <PendingFlowNodeCard pending={pending} /> },
      style: {
        ...nodeBaseStyle,
        background: "#ffffff",
        border: "1px dashed var(--primary)",
        boxShadow: "none",
      },
    });
    if (anchor) {
      edges.push({
        id: `${anchor.id}-to-${pendingNodeId}`,
        source: anchor.id,
        target: pendingNodeId,
        type: "smoothstep",
        animated: true,
        style: { stroke: "var(--primary)", strokeWidth: 1.5, strokeDasharray: "6 4" },
        markerEnd: { type: MarkerType.ArrowClosed, color: "var(--primary)" },
      });
    }
  }

  return { nodes, edges };
}

function PendingFlowNodeCard({ pending }: { readonly pending: MissionFlowPendingNode }) {
  return (
    <div className="grid gap-1.5 p-3 text-left" role="status" aria-live="polite">
      <span className="flex items-center gap-1.5 text-[0.62rem] font-black tracking-[0.16em] text-primary uppercase">
        <LoaderCircle className="size-3 animate-spin" aria-hidden />
        Recording
      </span>
      <span className="text-sm font-bold leading-5 text-slate-950">{pending.label}</span>
      {pending.description ? (
        <span className="text-xs leading-5 text-slate-600">{pending.description}</span>
      ) : null}
    </div>
  );
}

function MissionFlowNodeCard({ node }: { readonly node: IApiMissionFlowNode }) {
  // The start card sits on a solid primary background, so its text flips to white.
  const onPrimary = node.kind === "start";

  return (
    <div className="grid gap-1.5 p-3 text-left">
      <span
        className={`text-[0.62rem] font-black tracking-[0.16em] uppercase ${onPrimary ? "text-white/70" : "text-slate-500"}`}
      >
        {node.kind}
      </span>
      <span
        className={`text-sm font-bold leading-5 ${onPrimary ? "text-white" : "text-slate-950"}`}
      >
        {node.label}
      </span>
      <span
        className={`text-xs leading-5 ${onPrimary ? "text-white/80" : "text-slate-600"}`}
      >
        {node.description}
      </span>
      {node.evidence_event_ids?.length ? (
        <span className="mt-1 w-fit rounded-full bg-white/80 px-2 py-0.5 text-[0.62rem] font-bold text-primary">
          {node.evidence_event_ids.length} evidence {node.evidence_event_ids.length === 1 ? "event" : "events"}
        </span>
      ) : null}
    </div>
  );
}
