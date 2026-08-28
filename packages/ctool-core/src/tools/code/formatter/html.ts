import prettier from "prettier/standalone";
import babel from "prettier/plugins/babel";
import estree from "prettier/plugins/estree";
import html from "prettier/plugins/html";
import postcss from "prettier/plugins/postcss";
import typescript from "prettier/plugins/typescript";
import Base from "./base";

import { minify } from "html-minifier-terser";

export const formatter = new (class extends Base<'html'> {
    async beautify(): Promise<string> {
        return prettier.format(this.code, {
            plugins: [html, babel, typescript, estree, postcss],
            parser: "html",
            tabWidth: this.getOptionValue('tab', 4)
        });
    }

    async compress(): Promise<string> {
        return minify(this.code,{
            collapseWhitespace: true,
            removeComments: true,
            removeEmptyAttributes: true,
            removeRedundantAttributes: true,
            removeScriptTypeAttributes: true,
            removeStyleLinkTypeAttributes: true,
            collapseBooleanAttributes: true,
            useShortDoctype: true,
        })
    }
})
