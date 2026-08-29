"use client";

import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import { useMemo, type CSSProperties, type ReactNode } from "react";

import type {
  IApiMissionFlow,
  IApiMissionFlowNode,
} from "@/backend/api/api.interface";

type MissionFlowPreviewProps = {
  readonly emptyMessage?: string;
  readonly flow?: IApiMissionFlow | null;
};

type MissionReactFlowNode = Node<{ label: ReactNode }>;

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
    background: "#ecfeff",
    border: "1px solid #67e8f9",
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

export function MissionFlowPreview({
  emptyMessage = "Generate a preview to see Emily's mission flow.",
  flow,
}: MissionFlowPreviewProps) {
  const { nodes, edges } = useMemo(() => buildReactFlow(flow), [flow]);

  if (nodes.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm leading-6 text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="h-[560px] overflow-hidden rounded-md border border-border bg-slate-50">
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

function buildReactFlow(flow?: IApiMissionFlow | null): {
  nodes: MissionReactFlowNode[];
  edges: Edge[];
} {
  const flowNodes = Array.isArray(flow?.nodes) ? flow.nodes : [];
  if (flowNodes.length === 0) {
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

  return { nodes, edges };
}

function MissionFlowNodeCard({ node }: { readonly node: IApiMissionFlowNode }) {
  return (
    <div className="grid gap-1.5 p-3 text-left">
      <span className="text-[0.62rem] font-black tracking-[0.16em] text-slate-500 uppercase">
        {node.kind}
      </span>
      <span className="text-sm font-bold leading-5 text-slate-950">
        {node.label}
      </span>
      <span className="text-xs leading-5 text-slate-600">
        {node.description}
      </span>
      {node.evidence_event_ids?.length ? (
        <span className="mt-1 w-fit rounded-full bg-white/80 px-2 py-0.5 text-[0.62rem] font-bold text-violet-700">
          {node.evidence_event_ids.length} evidence {node.evidence_event_ids.length === 1 ? "event" : "events"}
        </span>
      ) : null}
    </div>
  );
}
