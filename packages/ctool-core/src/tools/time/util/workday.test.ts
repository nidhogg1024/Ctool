import { describe, expect, it } from "vitest";
import type { WorkdayErrorCode, WorkdayResult } from "./workday";
import { addWorkdays, countWorkdays } from "./workday";

const success = <T>(value: T): WorkdayResult<T> => ({ ok: true, value });
const failure = (error: WorkdayErrorCode): WorkdayResult<never> => ({ ok: false, error });

describe("time/util/workday", () => {
    it("uses official holiday and adjusted-workday data", () => {
        expect(countWorkdays("2026-02-14", "2026-02-14")).toEqual(success(1));
        expect(countWorkdays("2026-02-16", "2026-02-16")).toEqual(success(0));
        expect(countWorkdays("2026-06-19", "2026-06-19")).toEqual(success(0));
        expect(countWorkdays("2026-02-16", "2026-02-22")).toEqual(success(0));
        expect(countWorkdays("2026-02-14", "2026-02-24")).toEqual(success(2));
    });

    it("counts workdays in an inclusive date range", () => {
        expect(countWorkdays("2026-07-13", "2026-07-17")).toEqual(success(5));
        expect(countWorkdays("2026-07-17", "2026-07-20")).toEqual(success(2));
        expect(countWorkdays("2025-01-01", "2025-12-31")).toEqual(success(248));
        expect(countWorkdays("2026-01-01", "2026-12-31")).toEqual(success(248));
    });

    it("returns a negative count when the range is reversed", () => {
        expect(countWorkdays("2026-07-20", "2026-07-17")).toEqual(success(-2));
        expect(countWorkdays("2026-12-31", "2026-01-01")).toEqual(success(-248));
    });

    it("adds and subtracts workdays without counting the start date", () => {
        expect(addWorkdays("2026-07-17", 1)).toEqual(success("2026-07-20"));
        expect(addWorkdays("2026-07-20", -1)).toEqual(success("2026-07-17"));
        expect(addWorkdays("2026-06-22", 2)).toEqual(success("2026-06-24"));
        expect(addWorkdays("2026-06-22", -1)).toEqual(success("2026-06-18"));
        expect(addWorkdays("2026-07-18", 0)).toEqual(success("2026-07-18"));
    });

    it("adds and subtracts across official holidays and adjusted workdays", () => {
        expect(addWorkdays("2026-02-13", 1)).toEqual(success("2026-02-14"));
        expect(addWorkdays("2026-02-14", 1)).toEqual(success("2026-02-24"));
        expect(addWorkdays("2026-02-24", -1)).toEqual(success("2026-02-14"));
        expect(addWorkdays("2026-02-16", 1)).toEqual(success("2026-02-24"));
    });

    it.each([
        ["not-a-date", "2026-06-19"],
        ["2026-02-30", "2026-06-19"],
        ["2026/02/14", "2026-06-19"],
        ["2026-2-14", "2026-06-19"],
        ["2026-02-14T00:00:00", "2026-06-19"],
        ["2026-06-19", "2026-02-30"],
    ])("rejects an invalid date range (%s, %s)", (start, end) => {
        expect(countWorkdays(start, end)).toEqual(failure("invalid-date"));
    });

    it.each([
        "not-a-date",
        "2026-02-30",
        "2026/02/14",
        "2026-2-14",
        "2026-02-14T00:00:00",
    ])("rejects an invalid start date (%s)", (start) => {
        expect(addWorkdays(start, 1)).toEqual(failure("invalid-date"));
    });

    it("trims surrounding whitespace before strict date validation", () => {
        expect(countWorkdays(" 2026-02-14 ", " 2026-02-16 ")).toEqual(success(1));
        expect(addWorkdays(" 2026-07-18 ", 0)).toEqual(success("2026-07-18"));
    });

    it("accepts real leap days and rejects impossible ones", () => {
        expect(countWorkdays("2024-02-29", "2024-02-29")).toEqual(success(1));
        expect(countWorkdays("2026-02-29", "2026-02-29")).toEqual(failure("invalid-date"));
    });

    it("rejects years not covered by the official calendar data", () => {
        expect(countWorkdays("2003-12-31", "2004-01-01")).toEqual(failure("unsupported-year"));
        expect(countWorkdays("2026-12-31", "2027-01-01")).toEqual(failure("unsupported-year"));
        expect(addWorkdays("2003-12-31", 0)).toEqual(failure("unsupported-year"));
        expect(addWorkdays("2027-01-01", 0)).toEqual(failure("unsupported-year"));
        expect(addWorkdays("2004-01-01", -1)).toEqual(failure("unsupported-year"));
        expect(addWorkdays("2026-12-31", 1)).toEqual(failure("unsupported-year"));
    });

    it.each([
        Number.NaN,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        1.5,
        -1.5,
        Number.MAX_SAFE_INTEGER + 1,
        Number.MIN_SAFE_INTEGER - 1,
    ])("rejects a non-safe-integer day count (%s)", (days) => {
        expect(addWorkdays("2026-06-19", days)).toEqual(failure("invalid-count"));
    });

    it("fails quickly when an extreme safe integer crosses the supported range", () => {
        expect(addWorkdays("2026-12-31", Number.MAX_SAFE_INTEGER)).toEqual(
            failure("unsupported-year"),
        );
        expect(addWorkdays("2004-01-01", Number.MIN_SAFE_INTEGER)).toEqual(
            failure("unsupported-year"),
        );
    });
});
