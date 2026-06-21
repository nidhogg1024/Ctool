import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { describe, expect, it } from "vitest";
import { Format, InputType, transform } from "./timestamp";

dayjs.extend(utc);
dayjs.extend(timezone);

describe("time/util/timestamp", () => {
    it("accepts pasted unix second timestamps", () => {
        const output = transform("1767196800", "Asia/Shanghai");
        expect(output.isValid).toBe(true);
        expect(output.type).toBe(InputType.unix);
        expect(output.format).toBe(Format.second);
        expect(output.second).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });
});
