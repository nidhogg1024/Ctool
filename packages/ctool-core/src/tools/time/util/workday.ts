import { isWorkday as isChineseWorkday } from "chinese-days";
import dayjs, { Dayjs } from "dayjs";

export const WORKDAY_MIN_YEAR = 2004;
export const WORKDAY_MAX_YEAR = 2026;

export type WorkdayErrorCode = "invalid-date" | "invalid-count" | "unsupported-year";

export type WorkdayResult<T> =
    | { ok: true; value: T }
    | { ok: false; error: WorkdayErrorCode };

const success = <T>(value: T): WorkdayResult<T> => ({ ok: true, value });
const failure = (error: WorkdayErrorCode): WorkdayResult<never> => ({ ok: false, error });

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const parseDate = (input: string): WorkdayResult<Dayjs> => {
    const normalizedInput = input.trim();
    if (!DATE_PATTERN.test(normalizedInput)) {
        return failure("invalid-date");
    }

    const date = dayjs(normalizedInput);
    if (!date.isValid() || date.format("YYYY-MM-DD") !== normalizedInput) {
        return failure("invalid-date");
    }
    if (date.year() < WORKDAY_MIN_YEAR || date.year() > WORKDAY_MAX_YEAR) {
        return failure("unsupported-year");
    }
    return success(date.startOf("day"));
};

const isSupportedDate = (date: Dayjs) =>
    date.year() >= WORKDAY_MIN_YEAR && date.year() <= WORKDAY_MAX_YEAR;

// chinese-days falls back to weekdays outside its bundled data range, so callers
// must pass through parseDate/isSupportedDate before this helper is reached.
const isWorkday = (date: Dayjs) => isChineseWorkday(date.format("YYYY-MM-DD"));

const countWorkdaysForward = (start: Dayjs, end: Dayjs) => {
    let count = 0;
    let cursor = start;
    while (!cursor.isAfter(end, "day")) {
        if (isWorkday(cursor)) {
            count++;
        }
        cursor = cursor.add(1, "day");
    }
    return count;
};

export const countWorkdays = (startInput: string, endInput: string): WorkdayResult<number> => {
    const startResult = parseDate(startInput);
    if (!startResult.ok) {
        return startResult;
    }
    const endResult = parseDate(endInput);
    if (!endResult.ok) {
        return endResult;
    }

    const { value: start } = startResult;
    const { value: end } = endResult;
    if (start.isAfter(end, "day")) {
        return success(countWorkdaysForward(end, start) * -1);
    }
    return success(countWorkdaysForward(start, end));
};

export const addWorkdays = (startInput: string, days: number): WorkdayResult<string> => {
    const startResult = parseDate(startInput);
    if (!startResult.ok) {
        return startResult;
    }
    if (!Number.isSafeInteger(days)) {
        return failure("invalid-count");
    }
    if (days === 0) {
        return success(startResult.value.format("YYYY-MM-DD"));
    }

    let remaining = Math.abs(days);
    let cursor = startResult.value;
    const step = days > 0 ? 1 : -1;
    while (remaining > 0) {
        cursor = cursor.add(step, "day");
        if (!isSupportedDate(cursor)) {
            return failure("unsupported-year");
        }
        if (isWorkday(cursor)) {
            remaining--;
        }
    }
    return success(cursor.format("YYYY-MM-DD"));
};
