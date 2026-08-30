import {
  IApiRequestMethod,
  type IApiApproveTeacherClassMissionRequest,
  type IApiCreateTeacherClassMissionRequest,
  type IApiDashboardOverviewRequest,
  type IApiMissionPreviewProgress,
  type IApiDashboardOverviewResponse,
  type IApiStudentSession,
  type IApiStudentSessionValidation,
  type IApiStudentSessionValidationResponse,
  type IApiStudentPresence,
  type IApiStartStudentMission,
  type IApiStudentSessionResponse,
  type IApiStudentLearningResponse,
  type IApiStudentLearningSnapshotRequest,
  type IApiStudentTutorTurnRequest,
  type IApiStudentTutorTurnResponse,
  type IApiTeacherClassMissionsResponse,
  type IApiTeacherClassMissionResponse,
  type IApiTeacherClassesResponse,
  type IApiTeacherClassResponse,
  type IApiUpsertTeacherClassRequest,
} from "./api.interface";
import { ApiResources } from "./api.service";

export const API = {
  health: {
    async get(signal?: AbortSignal): Promise<void> {
      const res = await ApiResources.request({
        method: IApiRequestMethod.GET,
        path: "/",
        signal,
      });

      if (!res.ok) {
        throw await apiError(res, "API_HEALTH_CHECK_FAILED");
      }
    },
  },
  users: {
    async validateStudentSession(data: IApiStudentSessionValidation): Promise<IApiStudentSessionValidationResponse> {
      const res = await ApiResources.request({
        data,
        method: IApiRequestMethod.POST,
        path: "/users/student-session/validate",
      });

      if (!res.ok) {
        throw await apiError(res, "STUDENT_SESSION_VALIDATION_FAILED");
      }

      return (await res.json()) as IApiStudentSessionValidationResponse;
    },
    async studentSession(access_token: string, data: IApiStudentSession): Promise<IApiStudentSessionResponse> {
      const res = await ApiResources.request({
        access_token,
        data,
        method: IApiRequestMethod.POST,
        path: "/users/student-session",
      });

      if (!res.ok) {
        throw await apiError(res, "STUDENT_SESSION_FAILED");
      }

      return (await res.json()) as IApiStudentSessionResponse;
    },
    async startStudentMission(
      access_token: string,
      data: IApiStartStudentMission,
    ): Promise<IApiStudentSessionResponse> {
      const res = await ApiResources.request({
        access_token,
        data,
        method: IApiRequestMethod.POST,
        path: "/users/student-mission",
      });

      if (!res.ok) {
        throw await apiError(res, "STUDENT_MISSION_START_FAILED");
      }

      return (await res.json()) as IApiStudentSessionResponse;
    },
    async studentPresence(access_token: string, data: IApiStudentPresence): Promise<IApiStudentSessionResponse> {
      const res = await ApiResources.request({
        access_token,
        data,
        method: IApiRequestMethod.POST,
        path: "/users/student-presence",
      });

      if (!res.ok) {
        throw await apiError(res, "STUDENT_PRESENCE_FAILED");
      }

      return (await res.json()) as IApiStudentSessionResponse;
    },
    async studentLearning(
      access_token: string,
      mission_id: string,
    ): Promise<IApiStudentLearningResponse> {
      const res = await ApiResources.request({
        access_token,
        data: { mission_id },
        method: IApiRequestMethod.GET,
        path: "/users/student-learning",
      });

      if (!res.ok) {
        throw await apiError(res, "STUDENT_LEARNING_GET_FAILED");
      }

      return (await res.json()) as IApiStudentLearningResponse;
    },
    async saveStudentLearning(
      access_token: string,
      data: IApiStudentLearningSnapshotRequest,
      options?: { keepalive?: boolean },
    ): Promise<IApiStudentLearningResponse> {
      const res = await ApiResources.request({
        access_token,
        data,
        keepalive: options?.keepalive,
        method: IApiRequestMethod.POST,
        path: "/users/student-learning",
      });

      if (!res.ok) {
        throw await apiError(res, "STUDENT_LEARNING_SAVE_FAILED");
      }

      return (await res.json()) as IApiStudentLearningResponse;
    },
    async studentTutorTurn(
      access_token: string,
      data: IApiStudentTutorTurnRequest,
    ): Promise<IApiStudentTutorTurnResponse> {
      const res = await ApiResources.request({
        access_token,
        data,
        method: IApiRequestMethod.POST,
        path: "/users/student-tutor-turn",
      });

      if (!res.ok) {
        throw await apiError(res, "STUDENT_TUTOR_TURN_FAILED");
      }

      return (await res.json()) as IApiStudentTutorTurnResponse;
    },
  },
  dashboard: {
    async overview(access_token: string, data?: IApiDashboardOverviewRequest): Promise<IApiDashboardOverviewResponse> {
      const res = await ApiResources.request({
        access_token,
        data,
        method: IApiRequestMethod.GET,
        path: "/dashboard/overview",
      });

      if (!res.ok) {
        throw await apiError(res, "DASHBOARD_OVERVIEW_FAILED");
      }

      return (await res.json()) as IApiDashboardOverviewResponse;
    },
  },
  teacherClasses: {
    async list(access_token: string): Promise<IApiTeacherClassesResponse> {
      const res = await ApiResources.request({
        access_token,
        method: IApiRequestMethod.GET,
        path: "/teacher-classes",
      });

      if (!res.ok) {
        throw await apiError(res, "TEACHER_CLASSES_LIST_FAILED");
      }

      return (await res.json()) as IApiTeacherClassesResponse;
    },

    async get(access_token: string, class_id: string): Promise<IApiTeacherClassResponse> {
      const res = await ApiResources.request({
        access_token,
        method: IApiRequestMethod.GET,
        path: `/teacher-classes/${encodeURIComponent(class_id)}`,
      });

      if (!res.ok) {
        throw await apiError(res, "TEACHER_CLASS_GET_FAILED");
      }

      return (await res.json()) as IApiTeacherClassResponse;
    },

    async upsert(access_token: string, data: IApiUpsertTeacherClassRequest): Promise<IApiTeacherClassResponse> {
      const res = await ApiResources.request({
        access_token,
        data,
        method: IApiRequestMethod.POST,
        path: "/teacher-classes",
      });

      if (!res.ok) {
        throw await apiError(res, "TEACHER_CLASS_UPSERT_FAILED");
      }

      return (await res.json()) as IApiTeacherClassResponse;
    },
  },
  teacherClassMissions: {
    async preview(
      access_token: string,
      class_id: string,
      data: IApiCreateTeacherClassMissionRequest,
    ): Promise<IApiTeacherClassMissionResponse> {
      const res = await ApiResources.request({
        access_token,
        data,
        method: IApiRequestMethod.POST,
        path: `/teacher-classes/${encodeURIComponent(class_id)}/missions/preview`,
      });

      if (!res.ok) {
        throw await apiError(res, "TEACHER_CLASS_ACTIVITY_PREVIEW_FAILED");
      }

      return (await res.json()) as IApiTeacherClassMissionResponse;
    },

    async previewStream(
      access_token: string,
      class_id: string,
      data: IApiCreateTeacherClassMissionRequest,
      options?: {
        signal?: AbortSignal;
        onProgress?: (progress: IApiMissionPreviewProgress) => void;
      },
    ): Promise<IApiTeacherClassMissionResponse> {
      const headers = new Headers();
      headers.set("Accept", "text/event-stream");
      const res = await ApiResources.request({
        access_token,
        data,
        headers,
        method: IApiRequestMethod.POST,
        path: `/teacher-classes/${encodeURIComponent(class_id)}/missions/preview/stream`,
        signal: options?.signal,
      });

      if (!res.ok) {
        throw await apiError(res, "TEACHER_CLASS_ACTIVITY_PREVIEW_FAILED");
      }

      return readMissionPreviewEventStream(res, options?.onProgress);
    },

    async approve(
      access_token: string,
      class_id: string,
      mission_id: string,
      data?: IApiApproveTeacherClassMissionRequest,
    ): Promise<IApiTeacherClassMissionResponse> {
      const res = await ApiResources.request({
        access_token,
        data,
        method: IApiRequestMethod.POST,
        path: `/teacher-classes/${encodeURIComponent(class_id)}/missions/${encodeURIComponent(mission_id)}/approve`,
      });

      if (!res.ok) {
        throw await apiError(res, "TEACHER_CLASS_ACTIVITY_APPROVE_FAILED");
      }

      return (await res.json()) as IApiTeacherClassMissionResponse;
    },

    async remove(access_token: string, class_id: string, mission_id: string): Promise<void> {
      const res = await ApiResources.request({
        access_token,
        method: IApiRequestMethod.DELETE,
        path: `/teacher-classes/${encodeURIComponent(class_id)}/missions/${encodeURIComponent(mission_id)}`,
      });

      if (!res.ok) {
        throw await apiError(res, "TEACHER_CLASS_MISSION_DELETE_FAILED");
      }
    },

    async list(access_token: string, class_id: string): Promise<IApiTeacherClassMissionsResponse> {
      const res = await ApiResources.request({
        access_token,
        method: IApiRequestMethod.GET,
        path: `/teacher-classes/${encodeURIComponent(class_id)}/missions`,
      });

      if (!res.ok) {
        throw await apiError(res, "TEACHER_CLASS_ACTIVITY_LIST_FAILED");
      }

      return (await res.json()) as IApiTeacherClassMissionsResponse;
    },
  },
};

type ParsedServerSentEvent = {
  event: string;
  data: string;
};

async function readMissionPreviewEventStream(
  res: Response,
  onProgress?: (progress: IApiMissionPreviewProgress) => void,
): Promise<IApiTeacherClassMissionResponse> {
  const reader = res.body?.getReader();
  if (!reader) {
    throw new ApiError(
      res.status,
      "MISSION_PREVIEW_STREAM_UNAVAILABLE",
      "Mission preview stream is unavailable.",
    );
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: !done });
      const response = parseMissionPreviewStreamBuffer(buffer, onProgress);
      buffer = response.remaining;
      if (response.done) {
        return response.done;
      }
    }
    if (done) {
      const response = parseMissionPreviewStreamBuffer(`${buffer}\n\n`, onProgress);
      if (response.done) {
        return response.done;
      }
      break;
    }
  }

  throw new ApiError(
    res.status,
    "MISSION_PREVIEW_STREAM_ENDED",
    "Mission preview stream ended before returning a mission.",
  );
}

function parseMissionPreviewStreamBuffer(
  buffer: string,
  onProgress?: (progress: IApiMissionPreviewProgress) => void,
): {
  remaining: string;
  done: IApiTeacherClassMissionResponse | null;
} {
  let remaining = buffer;
  while (true) {
    const boundary = findServerSentEventBoundary(remaining);
    if (!boundary) {
      return { remaining, done: null };
    }

    const rawEvent = remaining.slice(0, boundary.index);
    remaining = remaining.slice(boundary.index + boundary.length);
    const parsed = parseServerSentEvent(rawEvent);
    if (!parsed) {
      continue;
    }

    if (parsed.event === "progress") {
      onProgress?.(JSON.parse(parsed.data) as IApiMissionPreviewProgress);
      continue;
    }

    if (parsed.event === "done") {
      return {
        remaining,
        done: JSON.parse(parsed.data) as IApiTeacherClassMissionResponse,
      };
    }

    if (parsed.event === "error") {
      throw streamApiError(JSON.parse(parsed.data) as ApiErrorBody);
    }
  }
}

function findServerSentEventBoundary(
  value: string,
): { index: number; length: number } | null {
  const lfIndex = value.indexOf("\n\n");
  const crlfIndex = value.indexOf("\r\n\r\n");
  if (lfIndex < 0 && crlfIndex < 0) {
    return null;
  }
  if (lfIndex < 0) {
    return { index: crlfIndex, length: 4 };
  }
  if (crlfIndex < 0 || lfIndex < crlfIndex) {
    return { index: lfIndex, length: 2 };
  }

  return { index: crlfIndex, length: 4 };
}

function parseServerSentEvent(rawEvent: string): ParsedServerSentEvent | null {
  const lines = rawEvent.split(/\r?\n/);
  let event = "message";
  const data: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      data.push(line.slice("data:".length).trimStart());
    }
  }

  if (data.length === 0) {
    return null;
  }

  return {
    event,
    data: data.join("\n"),
  };
}

function streamApiError(body: ApiErrorBody): ApiError {
  const code = body.error?.code ?? body.code ?? "MISSION_PREVIEW_STREAM_FAILED";
  const message =
    body.error?.message ??
    body.message ??
    "Mission preview stream failed.";

  return new ApiError(500, code, message);
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

type ApiErrorBody = {
  code?: string;
  message?: string;
  error?: { code?: string; message?: string };
};

/** Builds an ApiError from a failed response; `fallbackCode` is used when the body has no code. */
async function apiError(res: Response, fallbackCode: string): Promise<ApiError> {
  let body: ApiErrorBody = {};
  try {
    body = (await res.json()) as ApiErrorBody;
  } catch {
    // Non-JSON error body (proxy, network). Fall back to the status text.
  }

  const code = body.error?.code ?? body.code ?? fallbackCode;
  const message = body.error?.message ?? body.message ?? res.statusText ?? fallbackCode;
  return new ApiError(res.status, code, message);
}
