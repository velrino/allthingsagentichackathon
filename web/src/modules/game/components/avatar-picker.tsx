"use client";

import Image from "next/image";

import { getAvatarPortraitPath, getAvatarPreset, studentAvatarPresets, teacherAvatarPresetId } from "../avatars/avatar-presets";
import { TUTOR_NAME } from "../content/algebra-mission";
import type { AvatarPreset } from "../types/avatar";

export function AvatarPortrait({ preset, className = "" }: { readonly preset: AvatarPreset; readonly className?: string }) {
  return (
    <Image
      src={getAvatarPortraitPath(preset)}
      alt=""
      aria-hidden
      width={192}
      height={192}
      className={`rounded-full border border-white/15 bg-white/10 object-cover ${className}`}
    />
  );
}

type AvatarPickerProps = {
  readonly selectedAvatarId: string;
  readonly onSelect: (avatarId: string) => void;
  readonly onClose: () => void;
};

/** Dropdown under the top bar: pick who you play as. The teacher isn't on the list. */
export function AvatarPicker({ selectedAvatarId, onSelect, onClose }: AvatarPickerProps) {
  const teacher = getAvatarPreset(teacherAvatarPresetId);

  return (
    <div className="pointer-events-auto absolute inset-0 z-30" role="dialog" aria-label="Choose your character">
      <button type="button" aria-label="Close" className="absolute inset-0 cursor-default" onClick={onClose} />

      <section className="glass animate-rise absolute top-[calc(max(env(safe-area-inset-top),0.75rem)+3.5rem)] right-3 w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl p-3 sm:right-5">
        <div className="font-display flex items-center justify-between px-1">
          <p className="text-[0.62rem] font-semibold tracking-[0.2em] text-cyan-200/90 uppercase">Your character</p>
          <button type="button" onClick={onClose} className="rounded-full px-2 py-1 text-xs font-semibold text-slate-300 hover:bg-white/10">
            Done
          </button>
        </div>

        <div className="mt-2 grid grid-cols-5 gap-1.5">
          {studentAvatarPresets.map((preset) => {
            const selected = preset.id === selectedAvatarId;

            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={selected}
                title={preset.label}
                onClick={() => onSelect(preset.id)}
                className={`font-display grid justify-items-center gap-1 rounded-xl border px-1 py-2 text-[0.68rem] font-semibold transition active:translate-y-px ${
                  selected ? "border-cyan-300/70 bg-cyan-300/15 text-white shadow-[0_0_16px_rgba(103,232,249,0.35)]" : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10"
                }`}
              >
                <AvatarPortrait preset={preset} className="size-11" />
                <span className="w-full truncate text-center">{preset.label}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2">
          <AvatarPortrait preset={teacher} className="size-8" />
          <p className="text-xs text-slate-300">
            <span className="font-semibold text-white">{teacher.label}</span> is {TUTOR_NAME === teacher.label ? "your teacher" : `${TUTOR_NAME}, your teacher`} — she stays at the board.
          </p>
        </div>
      </section>
    </div>
  );
}
