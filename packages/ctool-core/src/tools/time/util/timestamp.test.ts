import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { describe, expect, it } from "vitest";
import { Format, InputType, transform } from "./timestamp";

dayjs.extend(utc);
dayjs.extend(timezone);

describe("time/util/timestamp", () => {
    it("converts unix seconds in the selected timezone", () => {
        const output = transform("1767196800", "Asia/Shanghai");
        expect(output.isValid).toBe(true);
        expect(output.type).toBe(InputType.unix);
        expect(output.format).toBe(Format.second);
        expect(output.second).toBe("2026-01-01 00:00:00");
        expect(output.millisecond).toBe("2026-01-01 00:00:00.000");
        expect(output.nanosecond).toBe("2026-01-01 00:00:00.000000000");
    });
});
