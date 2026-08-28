import {
  IApiRequestMethod,
  type IApiCreateTeacherClassActivityRequest,
  type IApiDashboardOverviewRequest,
  type IApiDashboardOverviewResponse,
  type IApiStudentSession,
  type IApiStudentPresence,
  type IApiStudentSessionResponse,
  type IApiTeacherClassActivitiesResponse,
  type IApiTeacherClassActivityResponse,
  type IApiTeacherClassesResponse,
  type IApiTeacherClassResponse,
  type IApiUpsertTeacherClassRequest,
} from "./api.interface";
import { ApiResources } from "./api.service";

export const API = {
  users: {
    async studentSession(access_token: string, data: IApiStudentSession): Promise<IApiStudentSessionResponse> {
      const res = await ApiResources.request({
        access_token,
        data,
        method: IApiRequestMethod.POST,
        path: "/users/student-session",
      });

      if (!res.ok) {
        throw new Error((await safeMessage(res)) ?? "STUDENT_SESSION_FAILED");
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
        throw new Error((await safeMessage(res)) ?? "STUDENT_PRESENCE_FAILED");
      }

      return (await res.json()) as IApiStudentSessionResponse;
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
        throw new Error((await safeMessage(res)) ?? "DASHBOARD_OVERVIEW_FAILED");
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
        throw new Error((await safeMessage(res)) ?? "TEACHER_CLASSES_LIST_FAILED");
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
        throw new Error((await safeMessage(res)) ?? "TEACHER_CLASS_GET_FAILED");
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
        throw new Error((await safeMessage(res)) ?? "TEACHER_CLASS_UPSERT_FAILED");
      }

      return (await res.json()) as IApiTeacherClassResponse;
    },
  },
  teacherClassActivities: {
    async preview(
      access_token: string,
      class_id: string,
      data: IApiCreateTeacherClassActivityRequest,
    ): Promise<IApiTeacherClassActivityResponse> {
      const res = await ApiResources.request({
        access_token,
        data,
        method: IApiRequestMethod.POST,
        path: `/teacher-classes/${encodeURIComponent(class_id)}/activities/preview`,
      });

      if (!res.ok) {
        throw new Error((await safeMessage(res)) ?? "TEACHER_CLASS_ACTIVITY_PREVIEW_FAILED");
      }

      return (await res.json()) as IApiTeacherClassActivityResponse;
    },

    async create(
      access_token: string,
      class_id: string,
      data: IApiCreateTeacherClassActivityRequest,
    ): Promise<IApiTeacherClassActivityResponse> {
      const res = await ApiResources.request({
        access_token,
        data,
        method: IApiRequestMethod.POST,
        path: `/teacher-classes/${encodeURIComponent(class_id)}/activities`,
      });

      if (!res.ok) {
        throw new Error((await safeMessage(res)) ?? "TEACHER_CLASS_ACTIVITY_CREATE_FAILED");
      }

      return (await res.json()) as IApiTeacherClassActivityResponse;
    },

    async approve(access_token: string, class_id: string, activity_id: string): Promise<IApiTeacherClassActivityResponse> {
      const res = await ApiResources.request({
        access_token,
        method: IApiRequestMethod.POST,
        path: `/teacher-classes/${encodeURIComponent(class_id)}/activities/${encodeURIComponent(activity_id)}/approve`,
      });

      if (!res.ok) {
        throw new Error((await safeMessage(res)) ?? "TEACHER_CLASS_ACTIVITY_APPROVE_FAILED");
      }

      return (await res.json()) as IApiTeacherClassActivityResponse;
    },

    async list(access_token: string, class_id: string): Promise<IApiTeacherClassActivitiesResponse> {
      const res = await ApiResources.request({
        access_token,
        method: IApiRequestMethod.GET,
        path: `/teacher-classes/${encodeURIComponent(class_id)}/activities`,
      });

      if (!res.ok) {
        throw new Error((await safeMessage(res)) ?? "TEACHER_CLASS_ACTIVITY_LIST_FAILED");
      }

      return (await res.json()) as IApiTeacherClassActivitiesResponse;
    },
  },
};

async function safeMessage(res: Response): Promise<string | undefined> {
  try {
    const body = (await res.json()) as { error?: { message?: string }; message?: string };
    return body.error?.message ?? body.message;
  } catch {
    return undefined;
  }
}
