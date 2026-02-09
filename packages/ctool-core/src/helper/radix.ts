import BigNumber from "bignumber.js";
import {$t} from "@/i18n";

export const defaultAlphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_@"

export default (base: string | number, source: number, target: number, alphabet: string = "") => {
    alphabet = alphabet || defaultAlphabet

    // 对于 36 进制及以下的输入，统一转小写以兼容大写十六进制（如 FF -> ff）
    // 因为自定义 ALPHABET 中 a-z 对应 10-35，A-Z 对应 36-61
    let input = `${base}`
    if (source <= 36) {
        input = input.toLowerCase()
    }

    const BN = BigNumber.clone({ALPHABET: alphabet, EXPONENTIAL_AT: 1e+9})
    const result = new BN(input, source)

    // bignumber.js 遇到无效输入不会抛异常，而是返回 NaN
    if (result.isNaN()) {
        throw new Error($t('radix_invalid_input', [source, base]))
    }

    return result.toString(target);
}
