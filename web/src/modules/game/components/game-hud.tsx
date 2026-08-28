"use client";

import { useState } from "react";

import { getAvatarPreset, teacherAvatarPresetId } from "../avatars/avatar-presets";
import { MISSION_TITLE, TUTOR_NAME } from "../content/algebra-mission";
import type { PodProgress } from "../state/student-memory";
import { POD_LABELS, POD_ORDER, type MovementRef, type PodId, type PodStatus } from "../types/game";
import { AvatarPicker, AvatarPortrait } from "./avatar-picker";
import { MovementPad } from "./movement-pad";

type GameHudProps = {
  readonly movementRef: MovementRef;
  readonly progress: Record<PodId, PodProgress>;
  readonly tutorPod: PodId;
  readonly tutorLine: string;
  readonly nearSeat: boolean;
  readonly noteCount: number;
  readonly noteFlash: number;
  readonly avatarPresetId: string;
  readonly onSelectAvatar: (presetId: string) => void;
  readonly onSit: () => void;
  readonly onOpenNotebook: () => void;
};

const SEGMENT_CLASS: Record<PodStatus, string> = {
  locked: "bg-white/12",
  ready: "bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.9)]",
  review: "bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.9)]",
  complete: "bg-lime-300 shadow-[0_0_10px_rgba(190,242,100,0.7)]",
};

/** Three short bars: the mission at a glance. Also used on the chalkboard header. */
export function PodDots({ progress, className = "" }: { readonly progress: Record<PodId, PodProgress>; readonly className?: string }) {
  return (
    <div className={`flex items-center gap-1 ${className}`} aria-label="Mission progress" role="img">
      {POD_ORDER.map((podId) => (
        <span
          key={podId}
          title={`${POD_LABELS[podId]} · ${progress[podId].status}`}
          className={`h-1.5 w-5 rounded-full transition-colors duration-500 ${SEGMENT_CLASS[progress[podId].status]}`}
        />
      ))}
    </div>
  );
}

function NotebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 3.5h11a1.5 1.5 0 0 1 1.5 1.5v14A1.5 1.5 0 0 1 17 20.5H6" />
      <path d="M6 3.5v17" />
      <path d="M3.5 7h2.5M3.5 12h2.5M3.5 17h2.5" />
      <path d="M10 8.5h5M10 12h5" />
    </svg>
  );
}

const pill =
  "pointer-events-auto font-display inline-flex h-12 select-none items-center justify-center gap-2 rounded-full px-5 text-center text-[0.95rem] font-semibold tracking-tight transition active:translate-y-px disabled:opacity-60";

function sitLabel(status: PodStatus, pod: PodId) {
  if (status === "complete") {
    return "Mission complete";
  }

  return `Sit down · ${POD_LABELS[pod]}`;
}

/**
 * Roaming HUD. Four things, in the corners, and nothing in the middle:
 * where you are in the mission, the tutor's notebook, what Emily is saying,
 * and the one action you can take right now.
 */
export function GameHud({
  movementRef,
  progress,
  tutorPod,
  tutorLine,
  nearSeat,
  noteCount,
  noteFlash,
  avatarPresetId,
  onSelectAvatar,
  onSit,
  onOpenNotebook,
}: GameHudProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const avatar = getAvatarPreset(avatarPresetId);
  const tutorAvatar = getAvatarPreset(teacherAvatarPresetId);
  const stageStatus = progress[tutorPod].status;
  const canSit = nearSeat && (stageStatus === "ready" || stageStatus === "review");

  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none text-white">
      {/* Mission chip */}
      <div className="glass animate-rise absolute top-[max(env(safe-area-inset-top),0.75rem)] left-3 flex h-12 items-center gap-2.5 rounded-2xl px-3 sm:h-auto sm:gap-3 sm:px-3.5 sm:py-2.5 sm:left-5">
        <PodDots progress={progress} />
        <div className="font-display leading-none">
          <p className="text-[0.56rem] font-semibold tracking-[0.12em] text-cyan-200/90 uppercase sm:text-[0.62rem] sm:tracking-[0.2em]">{MISSION_TITLE}</p>
          <p className="mt-1 hidden text-xs font-medium text-slate-300 sm:block">
            Next up · <span className="text-white">{POD_LABELS[tutorPod]}</span>
          </p>
        </div>
      </div>

      {/* Top-right: who you are, and the teacher's notebook */}
      <div className="absolute top-[max(env(safe-area-inset-top),0.75rem)] right-3 flex items-center gap-2 sm:right-5">
        <button
          type="button"
          onClick={() => setPickerOpen((open) => !open)}
          aria-expanded={pickerOpen}
          aria-label={`Change character (currently ${avatar.label})`}
          className="glass animate-rise pointer-events-auto flex h-12 items-center gap-2 rounded-full px-1.5 text-slate-100 transition hover:bg-white/10 active:translate-y-px sm:pr-3.5"
        >
          <AvatarPortrait preset={avatar} className="size-9" />
          <span className="font-display hidden text-sm font-semibold sm:inline">{avatar.label}</span>
          <svg viewBox="0 0 24 24" className={`hidden size-4 text-slate-400 transition sm:block ${pickerOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        <button
          type="button"
          onClick={onOpenNotebook}
          className="glass animate-rise pointer-events-auto flex h-12 items-center gap-2 rounded-full pr-2 pl-3.5 text-slate-100 transition hover:bg-white/10 active:translate-y-px"
          aria-label={`Open ${TUTOR_NAME}'s notebook`}
        >
          <NotebookIcon />
          <span className="font-display hidden text-sm font-semibold sm:inline">Notebook</span>
          <span
            key={noteFlash}
            className={`font-display grid size-8 place-items-center rounded-full bg-gradient-to-br from-cyan-300 to-violet-300 text-sm font-bold text-slate-950 ${noteFlash > 0 ? "animate-pop" : ""}`}
          >
            {noteCount}
          </span>
        </button>
      </div>

      {pickerOpen ? (
        <AvatarPicker
          selectedAvatarId={avatarPresetId}
          onSelect={(presetId) => {
            onSelectAvatar(presetId);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}

      {/* The teacher speaks */}
      {tutorLine ? (
        <div className="absolute bottom-[calc(190px+4rem+env(safe-area-inset-bottom))] left-3 right-3 sm:right-auto sm:bottom-7 sm:left-6 sm:max-w-md">
          <div className="glass animate-rise flex items-start gap-3 rounded-2xl px-4 py-3">
            <AvatarPortrait preset={tutorAvatar} className="mt-0.5 size-10 shrink-0 shadow-[0_0_18px_rgba(103,232,249,0.45)]" />
            <div className="min-w-0">
              <p className="font-display text-[0.62rem] font-semibold tracking-[0.2em] text-cyan-200/90 uppercase">{TUTOR_NAME}</p>
              <p className="mt-0.5 text-[0.95rem] leading-snug text-slate-100">{tutorLine}</p>
            </div>
          </div>
        </div>
      ) : null}

      {/* The one action */}
      <div className="absolute inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-20 flex justify-center sm:inset-x-auto sm:right-6 sm:bottom-7 sm:items-end">
        {nearSeat ? (
          <button
            type="button"
            disabled={!canSit}
            onClick={() => canSit && onSit()}
            className={`${pill} w-full max-w-[18rem] animate-rise sm:w-auto sm:max-w-none ${canSit ? "cta hover:brightness-105" : "glass text-slate-200"}`}
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 4v6M19 4v6M5 10h14v4H5zM7 14v6M17 14v6" />
            </svg>
            {sitLabel(stageStatus, tutorPod)}
          </button>
        ) : null}

      </div>

      {/* Controls hint, fades on its own */}
      <p className="font-display animate-fade-out absolute inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] text-center text-[0.7rem] font-medium tracking-wide text-white/60 sm:hidden">
        Drag here to walk · swipe the room to look around
      </p>
      <p className="font-display animate-fade-out absolute inset-x-0 top-[max(env(safe-area-inset-top),1.25rem)] hidden text-center text-xs font-medium tracking-wide text-white/50 sm:block">
        WASD to walk · drag to look around · click the glowing desk to go there
      </p>

      <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-10 h-[190px] sm:hidden">
        <MovementPad movementRef={movementRef} />
      </div>
    </div>
  );
}
