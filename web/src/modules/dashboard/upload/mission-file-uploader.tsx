"use client";

import * as UC from "@uploadcare/file-uploader";
import { useEffect, useId, useRef, useSyncExternalStore } from "react";

import "@uploadcare/file-uploader/web/uc-file-uploader-regular.min.css";

import type { IApiMissionAttachment } from "@/backend/api/api.interface";
import { cn } from "@/lib/utils";

UC.defineComponents(UC);

const DEFAULT_UPLOADCARE_PUBLIC_KEY = "5c2474782ec064c09ef1";
const MAX_FILES = 5;
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const subscribeToClientEnvironment = () => () => {};

type MissionFileUploaderProps = {
  readonly disabled?: boolean;
  readonly maxFiles?: number;
  readonly onAttachmentsChange: (attachments: IApiMissionAttachment[]) => void;
  readonly onErrorChange: (error: string | null) => void;
  readonly onUploadingChange: (uploading: boolean) => void;
};

export function MissionFileUploader({
  disabled = false,
  maxFiles = MAX_FILES,
  onAttachmentsChange,
  onErrorChange,
  onUploadingChange,
}: MissionFileUploaderProps) {
  const resolvedMaxFiles = Math.max(0, Math.min(MAX_FILES, maxFiles));
  const isClient = useSyncExternalStore(
    subscribeToClientEnvironment,
    () => true,
    () => false,
  );
  const reactId = useId();
  const contextName = `mission-files-${reactId.replace(/:/g, "")}`;
  const contextProviderRef = useRef<UC.UploadCtxProvider>(null);
  const publicKey = process.env.NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY?.trim() || DEFAULT_UPLOADCARE_PUBLIC_KEY;

  useEffect(() => {
    if (!isClient) {
      return;
    }

    const contextProvider = contextProviderRef.current;
    if (!contextProvider) {
      return;
    }

    function handleChange(event: UC.EventMap["change"]) {
      const collection = event.detail;
      const firstFailedEntry = collection.failedEntries[0];
      const firstError = firstFailedEntry?.errors[0] ?? collection.errors[0];

      onUploadingChange(collection.uploadingEntries.length > 0 || collection.idleEntries.length > 0);
      onAttachmentsChange(
        collection.successEntries.map((entry) => ({
          uploadcare_uuid: entry.uuid,
          cdn_url: entry.cdnUrl,
          file_name: entry.fileInfo.originalFilename || entry.name,
          mime_type: entry.mimeType || "application/octet-stream",
          size_bytes: entry.size,
        })),
      );
      onErrorChange(
        firstError
          ? `${firstFailedEntry?.name ? `${firstFailedEntry.name}: ` : ""}${firstError.message}`
          : null,
      );
    }

    contextProvider.addEventListener("change", handleChange);

    return () => {
      contextProvider.removeEventListener("change", handleChange);
      onUploadingChange(false);
    };
  }, [isClient, onAttachmentsChange, onErrorChange, onUploadingChange]);

  return (
    <div
      aria-disabled={disabled}
      className={cn(
        "min-h-12 rounded-md border border-dashed border-input bg-background px-3 py-3 transition focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      {resolvedMaxFiles === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">
          Remove an existing file before uploading another one.
        </p>
      ) : isClient ? (
        <>
          <uc-config
            ctx-name={contextName}
            pubkey={publicKey}
            multiple={resolvedMaxFiles > 1}
            multipleMax={resolvedMaxFiles}
            sourceList="local"
            accept=".pdf,.png,.jpg,.jpeg,.txt,.doc,.docx"
            maxLocalFileSizeBytes={MAX_FILE_SIZE_BYTES}
            confirmUpload={false}
            store={false}
          ></uc-config>
          <uc-file-uploader-regular ctx-name={contextName} class="uc-light"></uc-file-uploader-regular>
          <uc-upload-ctx-provider ref={contextProviderRef} ctx-name={contextName}></uc-upload-ctx-provider>
        </>
      ) : (
        <div className="h-10 animate-pulse rounded-md bg-muted" aria-hidden />
      )}
    </div>
  );
}
