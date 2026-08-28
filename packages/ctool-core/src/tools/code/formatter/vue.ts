import { format } from "prettier/standalone";
import babel from "prettier/plugins/babel";
import estree from "prettier/plugins/estree";
import html from "prettier/plugins/html";
import postcss from "prettier/plugins/postcss";
import typescript from "prettier/plugins/typescript";
import Base from "./base";

export const formatter = new (class extends Base<"vue"> {
    async beautify(): Promise<string> {
        return format(this.code, {
            plugins: [html, babel, typescript, estree, postcss],
            parser: "vue",
            tabWidth: this.getOptionValue("tab", 4),
        });
    }
});
