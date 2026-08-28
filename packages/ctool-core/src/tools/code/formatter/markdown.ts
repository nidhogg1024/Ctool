import prettier from "prettier/standalone";
import babel from "prettier/plugins/babel";
import estree from "prettier/plugins/estree";
import graphql from "prettier/plugins/graphql";
import html from "prettier/plugins/html";
import markdown from "prettier/plugins/markdown";
import postcss from "prettier/plugins/postcss";
import typescript from "prettier/plugins/typescript";
import yaml from "prettier/plugins/yaml";
import phpPlugin from "@prettier/plugin-php/standalone";
import javaPlugin from "prettier-plugin-java";
import Base from "./base";

export const formatter = new (class extends Base<'markdown'> {
    async beautify(): Promise<string> {
        return prettier.format(this.code, {
            plugins: [
                markdown,
                babel,
                estree,
                typescript,
                postcss,
                html,
                yaml,
                graphql,
                phpPlugin,
                javaPlugin,
            ],
            parser: "markdown",
            tabWidth: this.getOptionValue('tab', 4)
        });
    }
})
