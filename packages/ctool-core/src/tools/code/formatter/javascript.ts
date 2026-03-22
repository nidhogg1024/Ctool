import Base from "./base";
import { minify } from "terser";
import { format } from "prettier/standalone";
import babel from "prettier/plugins/babel";
import estree from "prettier/plugins/estree";

export const formatter = new (class extends Base<"javascript"> {
    async beautify(): Promise<string> {
        return format(this.code, {
            plugins: [babel, estree],
            parser: "babel",
            tabWidth: this.getOptionValue("tab", 4),
        });
    }

    async compress(): Promise<string> {
        const result = await minify(this.code, {
            keep_fnames: true,
            compress: false,
            mangle: false,
            format: {
                beautify: false,
            },
        });
        if (!result.code) {
            throw new Error("JS minify failed");
        }
        return result.code;
    }
});
