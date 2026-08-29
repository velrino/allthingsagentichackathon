export type DateFormatPreset = "date" | "date-time" | "day-month" | "time";

type DateValue = Date | number | string | null | undefined;

type FormatDateOptions = {
  readonly fallback?: string;
  readonly locale?: Intl.LocalesArgument;
  readonly preset?: DateFormatPreset;
};

const formatOptions: Record<DateFormatPreset, Intl.DateTimeFormatOptions> = {
  date: {
    day: "numeric",
    month: "short",
    year: "numeric",
  },
  "date-time": {
    dateStyle: "medium",
    timeStyle: "short",
  },
  "day-month": {
    day: "numeric",
    month: "short",
  },
  time: {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  },
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

export function formatDate(value: DateValue, options: FormatDateOptions = {}) {
  const fallback = options.fallback ?? "Never";
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  const locale = options.locale ?? "en";
  const preset = options.preset ?? "date-time";
  const cacheKey = JSON.stringify([locale, preset]);
  let formatter = formatterCache.get(cacheKey);

  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, formatOptions[preset]);
    formatterCache.set(cacheKey, formatter);
  }

  return formatter.format(date);
}
