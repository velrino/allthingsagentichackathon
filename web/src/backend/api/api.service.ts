import { IApiRequestMethod, type IApiRequest } from "./api.interface";

const LOCAL_API_BASE_URL = "http://localhost:4004";
const PRODUCTION_API_BASE_URL = "https://classgame-api-2057331207.us-east1.run.app";

const BASE_URL =
  process.env.NEXT_PUBLIC_CLASSGAME_API_BASE_URL?.trim() ||
  (process.env.NODE_ENV === "development" ? LOCAL_API_BASE_URL : PRODUCTION_API_BASE_URL);

export const ApiResources = {
  async request(parameters: IApiRequest): Promise<Response> {
    let url = `${BASE_URL}${parameters.path}`;
    const headers = new Headers(parameters.headers);

    if (!headers.has("Content-Type") && !(parameters.data instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    if (parameters.access_token) {
      headers.set("Authorization", `Bearer ${parameters.access_token}`);
    }

    const options: RequestInit = {
      headers,
      keepalive: parameters.keepalive,
      method: parameters.method,
    };

    if (parameters.method === IApiRequestMethod.GET && parameters.data) {
      const queryString = stringifyParams(parameters.data as Record<string, unknown>);
      url = `${url}?${queryString}`;
    } else if (parameters.data) {
      options.body = parameters.data instanceof FormData ? parameters.data : JSON.stringify(parameters.data);
    }

    return fetch(url, options);
  },
};

const stringifyParams = (params: Record<string, unknown>) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((val, index) => {
        searchParams.append(`${key}[${index}]`, String(val));
      });
    } else if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });

  return searchParams.toString();
};
