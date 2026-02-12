// @ts-nocheck

// https://github.com/fkei/JSON.minify/blob/master/minify.json.js
export default (json: string): string => {

    const tokenizer = /["\n\r]|(\/\*)|(\*\/)|(\/\/)/g;
        let in_string = false;
        let in_multiline_comment = false;
        let in_singleline_comment = false;
        let tmp; let tmp2; const new_str = []; let ns = 0; let from = 0; let lc; let rc;
        let prevFrom
    ;

    tokenizer.lastIndex = 0;

    while (tmp = tokenizer.exec(json)) {
        lc = RegExp.leftContext;
        rc = RegExp.rightContext;
        if (!in_multiline_comment && !in_singleline_comment) {
            tmp2 = lc.substring(from);
            if (!in_string) {
                tmp2 = tmp2.replace(/(\s)+/g, "");
            }
            new_str[ns++] = tmp2;
        }
        prevFrom = from;
        from = tokenizer.lastIndex;

        // found a " character, and we're not currently in
        // a comment? check for previous `\` escaping immediately
        // leftward adjacent to this match
        if (tmp[0] == "\"" && !in_multiline_comment && !in_singleline_comment) {
            // perform look-behind escaping match, but
            // limit left-context matching to only go back
            // to the position of the last token match
            //
            // see: https://github.com/getify/JSON.minify/issues/64
            tmp2 = lc.substring(prevFrom).match(/\\+$/);

            // start of string with ", or unescaped " character found to end string?
            if (!in_string || !tmp2 || (tmp2[0].length % 2) == 0) {
                in_string = !in_string;
            }
            from--; // include " character in next catch
            rc = json.substring(from);
        } else if (tmp[0] == "/*" && !in_string && !in_multiline_comment && !in_singleline_comment) {
            in_multiline_comment = true;
        } else if (tmp[0] == "*/" && !in_string && in_multiline_comment && !in_singleline_comment) {
            in_multiline_comment = false;
        } else if (tmp[0] == "//" && !in_string && !in_multiline_comment && !in_singleline_comment) {
            in_singleline_comment = true;
        } else if ((tmp[0] == "\n" || tmp[0] == "\r") && !in_string && !in_multiline_comment && in_singleline_comment) {
            in_singleline_comment = false;
        } else if (!in_multiline_comment && !in_singleline_comment && !(/\s/.test(tmp[0]))) {
            new_str[ns++] = tmp[0];
        }
    }
    // 处理最后剩余内容，去除多余空白字符
    new_str[ns++] = (rc || "").replace(/(\s)+/g, "");
    return new_str.join("").trim();
}
