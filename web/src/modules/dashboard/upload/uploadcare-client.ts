import type { IApiMissionAttachment } from "@/backend/api/api.interface";

const UPLOADCARE_UPLOAD_URL = "https://upload.uploadcare.com/base/";
const UPLOADCARE_CDN_URL = "https://ucarecdn.com";
const DEFAULT_UPLOADCARE_PUBLIC_KEY = "5c2474782ec064c09ef1";
const MAX_FILES = 5;
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

export async function uploadMissionFiles(files: FileList | File[]): Promise<IApiMissionAttachment[]> {
  const fileList = Array.from(files);
  const publicKey = getUploadcarePublicKey();

  if (fileList.length === 0) {
    return [];
  }
  if (fileList.length > MAX_FILES) {
    throw new Error(`Select ${MAX_FILES} files or fewer.`);
  }
  if (!publicKey) {
    throw new Error("Uploadcare public key is not configured.");
  }

  return Promise.all(fileList.map((file) => uploadMissionFile(publicKey, file)));
}

async function uploadMissionFile(publicKey: string, file: File): Promise<IApiMissionAttachment> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`${file.name} is larger than 20 MB.`);
  }

  const data = new FormData();
  data.append("UPLOADCARE_PUB_KEY", publicKey);
  data.append("UPLOADCARE_STORE", "auto");
  data.append("file", file, file.name);

  const response = await fetch(UPLOADCARE_UPLOAD_URL, {
    body: data,
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`Could not upload ${file.name}.`);
  }

  const body = (await response.json()) as Record<string, string>;
  const uploadcareUUID = Object.values(body)[0];
  if (!uploadcareUUID) {
    throw new Error(`Uploadcare did not return a file ID for ${file.name}.`);
  }

  return {
    uploadcare_uuid: uploadcareUUID,
    cdn_url: `${UPLOADCARE_CDN_URL}/${uploadcareUUID}/`,
    file_name: file.name,
    mime_type: file.type || "application/octet-stream",
    size_bytes: file.size,
  };
}

function getUploadcarePublicKey() {
  return process.env.NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY?.trim() || DEFAULT_UPLOADCARE_PUBLIC_KEY;
}
