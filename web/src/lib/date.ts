import { DateTime } from "luxon";

export type DateFormatPreset = "date" | "date-time" | "day-month" | "time";

type DateValue = Date | number | string | null | undefined;

type FormatDateOptions = {
  readonly fallback?: string;
  readonly locale?: string;
  readonly preset?: DateFormatPreset;
  readonly relative?: boolean;
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

export function formatDate(value: DateValue, options: FormatDateOptions = {}) {
  const fallback = options.fallback ?? "Never";
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const date = toDateTime(value);
  if (!date.isValid) {
    return fallback;
  }

  const locale = options.locale ?? "en";
  const localizedDate = date.setLocale(locale);
  if (options.relative) {
    return localizedDate.toRelative() ?? fallback;
  }

  const preset = options.preset ?? "date-time";
  return localizedDate.toLocaleString(formatOptions[preset]);
}

function toDateTime(value: Exclude<DateValue, null | undefined>) {
  if (value instanceof Date) {
    return DateTime.fromJSDate(value);
  }
  if (typeof value === "number") {
    return DateTime.fromMillis(value);
  }

  return DateTime.fromISO(value);
}
