import { ApiError } from "@/backend/api/api.endpoints";

/**
 * Copy shown to students (ages ~11-14) while entering a mission.
 * Short sentences, no product or engineering vocabulary, always a next step.
 * The API keeps its technical messages for logs; the game owns the words.
 */
export const studentEntryCopy = {
  codeHint: "6 letters and numbers, like ABC234.",
  codeBlockedHint: "Codes never use O, 0, I, 1 or L. Try the next letter.",
  nameHint: "So Emily knows who you are.",
  nameTooShort: "One more letter, please.",
  opening: "Opening the classroom...",
  errors: {
    codeNotFound:
      "Hmm, that code doesn't match any mission. Check it with your teacher and try again.",
    codeFormat: "Mission codes have 6 letters and numbers, like ABC234.",
    nameMissing: "Type your name so Emily knows who you are.",
    tooManyTries: "Too many tries. Wait a minute and try again.",
    signIn: "Something went wrong signing you in. Refresh the page and try again.",
    offline: "We couldn't reach the classroom right now. Try again in a moment.",
  },
} as const;

export function describeStudentEntryError(error: unknown): string {
  const { errors } = studentEntryCopy;

  if (error instanceof ApiError) {
    switch (error.code) {
      case "mission_not_found":
        return errors.codeNotFound;
      case "validation_failed":
        return describeValidationError(error.message);
      case "rate_limited":
        return errors.tooManyTries;
      case "forbidden":
      case "unauthorized":
        return errors.signIn;
      default:
        return errors.offline;
    }
  }

  // firebase/auth errors carry codes like "auth/network-request-failed".
  const firebaseCode = readFirebaseCode(error);
  if (firebaseCode) {
    return firebaseCode === "auth/network-request-failed" ? errors.offline : errors.signIn;
  }

  return errors.offline;
}

function describeValidationError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("mission_code")) {
    return studentEntryCopy.errors.codeFormat;
  }
  if (normalized.includes("student_name")) {
    return studentEntryCopy.errors.nameMissing;
  }

  return studentEntryCopy.errors.codeFormat;
}

function readFirebaseCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && code.startsWith("auth/") ? code : null;
}
