export type PodId = "fractions" | "simple-equations" | "two-step-equations";

export const POD_ORDER: readonly PodId[] = ["fractions", "simple-equations", "two-step-equations"];

export const POD_LABELS: Record<PodId, string> = {
  fractions: "Fractions",
  "simple-equations": "Simple equations",
  "two-step-equations": "Two-step equations",
};

/** locked → ready → complete; "review" is a completed pod reopened by the tutor. */
export type PodStatus = "locked" | "ready" | "review" | "complete";

export type FeedbackValue = "helpful" | "confusing" | "too-easy" | "too-hard";

export type ExplanationStyle = "steps" | "visual";

/** What React wants the 3D world to look like. Read by the render loop every frame. */
export type WorldDirective = {
  readonly podStatus: Record<PodId, PodStatus>;
  /** The stage the student is on; colours the seat marker. */
  readonly tutorPod: PodId;
  readonly tutorThinking: boolean;
  readonly seated: boolean;
  /** Ask the avatar to walk to the desk. */
  readonly walkRequest: { readonly token: number } | null;
  /** Which chibi the student plays as; swapped live when it changes. */
  readonly avatarPresetId: string;
};

/** What the 3D world tells React, only when it changes. */
export type WorldReport = {
  readonly nearSeat: boolean;
  readonly walking: boolean;
  readonly ready: boolean;
};

export type MovementState = { forward: number; right: number };
export type MovementRef = { current: MovementState };
export type WorldDirectiveRef = { current: WorldDirective };
