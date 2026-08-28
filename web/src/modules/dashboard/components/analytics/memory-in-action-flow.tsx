"use client";

import {
  BookOpenText,
  BrainCircuit,
  CheckCircle2,
  MessageCircleMore,
  Search,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";

import { cn } from "@/lib/utils";

type MemoryJourneyKind = "conversation" | "memory" | "goal" | "retrieval" | "adaptation" | "outcome";

type MemoryJourneyData = {
  detail: string;
  evidence: string;
  eyebrow: string;
  hasSource?: boolean;
  hasTarget?: boolean;
  kind: MemoryJourneyKind;
  title: string;
};

type MemoryJourneyNode = Node<MemoryJourneyData, "memoryJourney">;

type MemoryInActionFlowProps = {
  readonly learningGoal?: string;
  readonly progress?: number;
  readonly rememberedSignal?: string;
  readonly studentName?: string;
};

const nodeStyles: Record<MemoryJourneyKind, { accent: string; icon: LucideIcon; surface: string }> = {
  conversation: {
    accent: "#7e4bff",
    icon: MessageCircleMore,
    surface: "bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-200",
  },
  memory: {
    accent: "#6236ff",
    icon: BrainCircuit,
    surface: "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-200",
  },
  goal: {
    accent: "#007bff",
    icon: BookOpenText,
    surface: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-200",
  },
  retrieval: {
    accent: "#0097ff",
    icon: Search,
    surface: "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-200",
  },
  adaptation: {
    accent: "#00b4ac",
    icon: Sparkles,
    surface: "bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-200",
  },
  outcome: {
    accent: "#44be32",
    icon: CheckCircle2,
    surface: "bg-green-50 text-green-700 dark:bg-green-950/60 dark:text-green-200",
  },
};

const nodeTypes = { memoryJourney: MemoryJourneyNodeCard };

const widePositions: Record<MemoryJourneyKind, { x: number; y: number }> = {
  conversation: { x: 0, y: 16 },
  memory: { x: 0, y: 146 },
  goal: { x: 0, y: 276 },
  retrieval: { x: 340, y: 146 },
  adaptation: { x: 660, y: 146 },
  outcome: { x: 980, y: 146 },
};

const compactPositions: Record<MemoryJourneyKind, { x: number; y: number }> = {
  conversation: { x: 0, y: 0 },
  memory: { x: 0, y: 140 },
  goal: { x: 0, y: 280 },
  retrieval: { x: 0, y: 440 },
  adaptation: { x: 0, y: 590 },
  outcome: { x: 0, y: 740 },
};

export function MemoryInActionFlow({
  learningGoal = "Explain the reasoning behind each answer before moving on.",
  progress,
  rememberedSignal = "Sign errors tend to appear during multi-step problems.",
  studentName = "Maya",
}: MemoryInActionFlowProps) {
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 639px)");
    const syncLayout = () => setIsCompact(mediaQuery.matches);

    syncLayout();
    mediaQuery.addEventListener("change", syncLayout);

    return () => mediaQuery.removeEventListener("change", syncLayout);
  }, []);

  const nodes = useMemo<MemoryJourneyNode[]>(
    () => {
      const positions = isCompact ? compactPositions : widePositions;

      return [
      journeyNode("conversation", positions.conversation.x, positions.conversation.y, {
        detail: `${studentName} asked for concrete examples and shorter steps.`,
        evidence: "Emily brought forward a preference the student shared in an earlier conversation.",
        eyebrow: "Earlier conversation",
        hasSource: true,
        kind: "conversation",
        title: "How the student learns",
      }),
      journeyNode("memory", positions.memory.x, positions.memory.y, {
        detail: rememberedSignal,
        evidence: `Saved learning note for ${studentName}: ${rememberedSignal}`,
        eyebrow: "Saved learning note",
        hasSource: true,
        kind: "memory",
        title: "A pattern Emily remembers",
      }),
      journeyNode("goal", positions.goal.x, positions.goal.y, {
        detail: learningGoal,
        evidence: `The goal set by the teacher for today's activity: ${learningGoal}`,
        eyebrow: "Today's activity",
        hasSource: true,
        kind: "goal",
        title: "What the teacher asked",
      }),
      journeyNode("retrieval", positions.retrieval.x, positions.retrieval.y, {
        detail: "Past dialogue, student memory, and the current lesson are brought together.",
        evidence: "Before replying, Emily looked up the most useful context from all three sources.",
        eyebrow: "Context lookup",
        hasSource: true,
        hasTarget: true,
        kind: "retrieval",
        title: "What Emily checked",
      }),
      journeyNode("adaptation", positions.adaptation.x, positions.adaptation.y, {
        detail: "Emily starts visually, uses one guided check, and keeps each step short.",
        evidence: "Emily changed the explanation because of what she remembered and what the teacher asked.",
        eyebrow: "Adapted help",
        hasSource: true,
        hasTarget: true,
        kind: "adaptation",
        title: "What Emily changed",
      }),
      journeyNode("outcome", positions.outcome.x, positions.outcome.y, {
        detail: progress === undefined ? "The next step was completed with less support." : `${progress}% class progress recorded.`,
        evidence:
          progress === undefined
            ? "The learner completed the retry after receiving the adapted explanation."
            : `${studentName}'s latest dashboard signal shows ${progress}% progress.`,
        eyebrow: "What happened next",
        hasTarget: true,
        kind: "outcome",
        title: "Progress improved",
      }),
    ];
    },
    [isCompact, learningGoal, progress, rememberedSignal, studentName],
  );

  const edges = useMemo<Edge[]>(
    () => [
      journeyEdge("conversation-retrieval", "conversation", "retrieval", "#7e4bff"),
      journeyEdge("memory-retrieval", "memory", "retrieval", "#6236ff"),
      journeyEdge("goal-retrieval", "goal", "retrieval", "#007bff"),
      journeyEdge("retrieval-adaptation", "retrieval", "adaptation", "#0097ff", true),
      journeyEdge("adaptation-outcome", "adaptation", "outcome", "#00b4ac", true),
    ],
    [],
  );

  const [selectedNodeId, setSelectedNodeId] = useState("retrieval");
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? nodes[3];
  const visibleNodes = useMemo(
    () => nodes.map((node) => ({ ...node, selected: node.id === selectedNodeId })),
    [nodes, selectedNodeId],
  );
  const selectedStyle = nodeStyles[selectedNode.data.kind];
  const SelectedIcon = selectedStyle.icon;

  return (
    <div className="space-y-3">
      <div className="h-[900px] overflow-hidden rounded-lg border border-border bg-muted/20 sm:h-[420px]">
        <ReactFlow<MemoryJourneyNode, Edge>
          key={isCompact ? "compact" : "wide"}
          nodes={visibleNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          edgesReconnectable={false}
          elementsSelectable
          zoomOnScroll={false}
          zoomOnDoubleClick={false}
          panOnScroll={false}
          preventScrolling={false}
          minZoom={0.45}
          maxZoom={1.25}
          fitView
          fitViewOptions={{ maxZoom: 1, padding: 0.12 }}
          proOptions={{ hideAttribution: true }}
          onNodeClick={(_event, node) => setSelectedNodeId(node.id)}
          aria-label="How Emily retrieves memory and adapts a response"
        />
      </div>

      <div className="flex min-h-20 items-start gap-3 rounded-lg border border-border bg-muted/30 p-4" aria-live="polite">
        <div className={cn("grid size-9 shrink-0 place-items-center rounded-md", selectedStyle.surface)}>
          <SelectedIcon className="size-4" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Why this step matters · {selectedNode.data.eyebrow}
          </p>
          <p className="mt-1 text-sm leading-6 text-foreground">{selectedNode.data.evidence}</p>
        </div>
      </div>
    </div>
  );
}

function MemoryJourneyNodeCard({ data, selected }: NodeProps<MemoryJourneyNode>) {
  const style = nodeStyles[data.kind];
  const Icon = style.icon;

  return (
    <div
      className={cn(
        "w-56 cursor-pointer rounded-xl border bg-card p-3.5 text-start shadow-sm transition-[box-shadow,border-color,transform] hover:-translate-y-0.5 hover:shadow-md",
        selected ? "border-primary ring-2 ring-primary/15" : "border-border",
      )}
      style={{ borderTopColor: style.accent, borderTopWidth: 3 }}
    >
      {data.hasTarget ? (
        <Handle type="target" position={Position.Left} className="!size-2.5 !border-2 !border-card !bg-muted-foreground" />
      ) : null}
      <div className="flex items-start gap-3">
        <div className={cn("grid size-8 shrink-0 place-items-center rounded-md", style.surface)}>
          <Icon className="size-4" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-[0.12em] text-muted-foreground uppercase">{data.eyebrow}</p>
          <p className="mt-1 text-sm font-semibold text-card-foreground">{data.title}</p>
        </div>
      </div>
      <p className="mt-3 line-clamp-3 text-xs leading-5 text-muted-foreground">{data.detail}</p>
      {data.hasSource ? (
        <Handle type="source" position={Position.Right} className="!size-2.5 !border-2 !border-card !bg-muted-foreground" />
      ) : null}
    </div>
  );
}

function journeyNode(id: string, x: number, y: number, data: MemoryJourneyData): MemoryJourneyNode {
  return {
    id,
    type: "memoryJourney",
    position: { x, y },
    data,
    ariaLabel: `${data.eyebrow}: ${data.title}. ${data.detail}`,
    deletable: false,
    draggable: false,
  };
}

function journeyEdge(id: string, source: string, target: string, color: string, animated = false): Edge {
  return {
    id,
    source,
    target,
    type: "smoothstep",
    animated,
    markerEnd: { color, height: 16, type: MarkerType.ArrowClosed, width: 16 },
    style: { stroke: color, strokeWidth: 2 },
  };
}
