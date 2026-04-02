export const normalizeDetectedFormat = <T extends string>(value: string, supportedFormats: readonly T[]): T | null => {
    const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
    const aliasMap: Record<string, string> = {
        querystring: "http_query_string",
        query_string: "http_query_string",
        http_query: "http_query_string",
        htmltable: "html_table",
        table: "html_table",
    };
    const candidate = (aliasMap[normalized] || normalized) as T;
    return supportedFormats.includes(candidate) ? candidate : null;
}
