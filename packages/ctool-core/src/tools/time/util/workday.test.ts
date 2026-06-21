import dayjs from "dayjs";
import { describe, expect, it } from "vitest";
import { addWorkdays, countWorkdays, isWorkday } from "./workday";

describe("time/util/workday", () => {
    it("identifies weekdays and weekends", () => {
        expect(isWorkday(dayjs("2026-06-19"))).toBe(true);
        expect(isWorkday(dayjs("2026-06-20"))).toBe(false);
        expect(isWorkday(dayjs("2026-06-21"))).toBe(false);
    });

    it("counts workdays in an inclusive date range", () => {
        expect(countWorkdays("2026-06-15", "2026-06-19")).toBe(5);
        expect(countWorkdays("2026-06-19", "2026-06-22")).toBe(2);
    });

    it("returns a negative count when the range is reversed", () => {
        expect(countWorkdays("2026-06-22", "2026-06-19")).toBe(-2);
    });

    it("adds and subtracts workdays across weekends", () => {
        expect(addWorkdays("2026-06-19", 1)).toBe("2026-06-22");
        expect(addWorkdays("2026-06-22", -1)).toBe("2026-06-19");
        expect(addWorkdays("2026-06-20", 0)).toBe("2026-06-20");
    });

    it("returns null for invalid input", () => {
        expect(countWorkdays("not-a-date", "2026-06-19")).toBeNull();
        expect(addWorkdays("not-a-date", 1)).toBeNull();
        expect(addWorkdays("2026-06-19", Number.NaN)).toBeNull();
    });
});
