import {
  IApiRequestMethod,
  type IApiStudentSession,
  type IApiStudentSessionResponse,
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
