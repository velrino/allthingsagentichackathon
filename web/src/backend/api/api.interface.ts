export enum IApiRequestMethod {
  GET = "GET",
  DELETE = "DELETE",
  POST = "POST",
  PUT = "PUT",
}

export interface IApiRequest {
  method: IApiRequestMethod;
  path: string;
  data?: unknown;
  headers?: Headers;
  access_token?: string;
}

export interface IApiStudentSession {
  turma_id: string;
  student_name: string;
}

export interface IApiStudentSessionUser {
  id: string;
  identity: {
    provider: string;
    provider_user_id: string;
    auth_method: string;
    sign_in_provider: string;
  };
  profile: {
    display_name: string;
    email: string;
    email_verified: boolean;
    photo_url: string;
  };
  student: {
    turma_id: string;
    student_name: string;
  };
  activity: {
    first_seen_at: string;
    last_seen_at: string;
    login_count: number;
  };
  roles: string[];
  is_guest: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface IApiStudentSessionResponse {
  user: IApiStudentSessionUser;
}
