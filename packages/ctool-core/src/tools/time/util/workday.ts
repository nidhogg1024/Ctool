import dayjs, { Dayjs } from "dayjs";

const parseDate = (input: string): Dayjs | null => {
    const date = dayjs((input || "").trim());
    if (!date.isValid()) {
        return null;
    }
    return date.startOf("day");
};

const isWorkday = (date: Dayjs) => {
    const week = date.day();
    return week !== 0 && week !== 6;
};

const countWorkdaysForward = (start: Dayjs, end: Dayjs) => {
    const totalDays = end.diff(start, "day") + 1;
    const wholeWeeks = Math.floor(totalDays / 7);
    let count = wholeWeeks * 5;
    let cursor = start.add(wholeWeeks * 7, "day");
    while (!cursor.isAfter(end, "day")) {
        if (isWorkday(cursor)) {
            count++;
        }
        cursor = cursor.add(1, "day");
    }
    return count;
};

export const countWorkdays = (startInput: string, endInput: string): number | null => {
    const start = parseDate(startInput);
    const end = parseDate(endInput);
    if (!start || !end) {
        return null;
    }
    if (start.isAfter(end, "day")) {
        return countWorkdaysForward(end, start) * -1;
    }
    return countWorkdaysForward(start, end);
};

export const addWorkdays = (startInput: string, days: number): string | null => {
    const start = parseDate(startInput);
    if (!start || !Number.isFinite(days)) {
        return null;
    }
    let remaining = Math.abs(Math.trunc(days));
    let cursor = start;
    const step = days >= 0 ? 1 : -1;
    while (remaining > 0) {
        cursor = cursor.add(step, "day");
        if (isWorkday(cursor)) {
            remaining--;
        }
    }
    return cursor.format("YYYY-MM-DD");
};

export { isWorkday };
