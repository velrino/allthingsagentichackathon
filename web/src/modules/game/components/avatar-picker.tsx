"use client";

import Image from "next/image";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import {
  getAvatarPortraitPath,
  getAvatarPreset,
  studentAvatarPresets,
  teacherAvatarPresetId,
} from "../avatars/avatar-presets";
import { TUTOR_NAME } from "../content/mission";
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
  readonly onLogout: () => void;
};

/** Player menu: character selection and session settings. */
export function AvatarPicker({
  selectedAvatarId,
  onSelect,
  onClose,
  onLogout,
}: AvatarPickerProps) {
  const teacher = getAvatarPreset(teacherAvatarPresetId);
  const selectedAvatar = getAvatarPreset(selectedAvatarId);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="glass max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden border-white/10 bg-[#090c18] p-0 text-white sm:max-w-xl">
        <DialogHeader className="border-b border-white/10 px-5 py-4 pr-12 text-start">
          <DialogTitle className="font-display text-xl">Player menu</DialogTitle>
          <DialogDescription className="text-slate-400">
            Choose your character or manage this session.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          defaultValue="characters"
          className="min-h-0 gap-0 overflow-hidden p-4"
        >
          <TabsList className="grid h-11 w-full grid-cols-2 rounded-xl bg-white/[0.06] p-1 text-slate-400">
            <TabsTrigger
              value="characters"
              className="h-full rounded-lg text-slate-300 data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              Characters
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="h-full rounded-lg text-slate-300 data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="characters"
            className="mt-4 min-h-0 overflow-y-auto"
          >
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {studentAvatarPresets.map((preset) => {
                const selected = preset.id === selectedAvatarId;

                return (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={selected}
                    title={preset.label}
                    onClick={() => onSelect(preset.id)}
                    className={`font-display grid justify-items-center gap-1.5 rounded-xl border px-1 py-2.5 text-xs font-semibold transition active:translate-y-px ${
                      selected
                        ? "border-cyan-300/70 bg-cyan-300/15 text-white shadow-[0_0_16px_rgba(103,232,249,0.35)]"
                        : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    <AvatarPortrait preset={preset} className="size-12" />
                    <span className="w-full truncate text-center">
                      {preset.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
              <AvatarPortrait preset={teacher} className="size-9" />
              <p className="text-xs leading-5 text-slate-300">
                <span className="font-semibold text-white">{teacher.label}</span>{" "}
                is{" "}
                {TUTOR_NAME === teacher.label
                  ? "your teacher"
                  : `${TUTOR_NAME}, your teacher`}{" "}
                — she stays at the board.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="mt-4 space-y-3">
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <AvatarPortrait preset={selectedAvatar} className="size-12" />
              <div>
                <p className="font-display text-sm font-semibold text-white">
                  {selectedAvatar.label}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Your current character
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <p className="font-display text-sm font-semibold text-white">
                Student session
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Log out to leave this class and enter another class code.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                className="font-display mt-3 flex h-11 w-full items-center justify-center rounded-full border border-red-300/25 bg-red-400/10 px-4 text-sm font-semibold text-red-100 transition hover:border-red-300/40 hover:bg-red-400/15 active:translate-y-px"
              >
                Log out
              </button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
