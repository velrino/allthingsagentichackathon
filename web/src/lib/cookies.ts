const defaultMaxAge = 60 * 60 * 24 * 7;

export function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") {
    return undefined;
  }

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);

  if (parts.length !== 2) {
    return undefined;
  }

  return parts.pop()?.split(";").shift();
}

export function setCookie(name: string, value: string, maxAge = defaultMaxAge): void {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${name}=${value}; path=/; max-age=${maxAge}`;
}
