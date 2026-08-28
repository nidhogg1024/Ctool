import prettier from "prettier/standalone";
import estree from "prettier/plugins/estree";
import typescript from "prettier/plugins/typescript";
import Base from "./base";

export const formatter = new (class extends Base<"typescript"> {
    async beautify(): Promise<string> {
        return prettier.format(this.code, {
            plugins: [typescript, estree],
            parser: "typescript",
            tabWidth: this.getOptionValue("tab", 4),
        });
    }
});


