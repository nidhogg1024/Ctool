import {ip2long, long2ip, Netmask} from "netmask"
import convert from "@/helper/radix";

const tryBinaryToDecimal = (ip:string) => {
    if (ip.includes('.') && ip.substring(0, 2).toUpperCase() === "0B") {
        return ipConvert(ip, 10, 2, '0b')
    }
    return ip
}

export const ipConvert = (ip: string, toRadix = 10, fromRadix = 10, filterPrefix = "") => {
    return ip.split('.').map((item) => {
        // 移除前缀
        if (
            filterPrefix
            && item.length > filterPrefix.length
            && item.substring(0, filterPrefix.length).toUpperCase() === filterPrefix.toUpperCase()
        ) {
            item = item.substring(filterPrefix.length)
        }
        // 移除补零
        item = item.replace(/\b(0+)/g, "") || "0"
        if (toRadix === fromRadix) {
            return `${item}`;
        }

        return `${convert(item, fromRadix, toRadix).padStart(toRadix === 2 ? 8 : (toRadix === 8 ? 4 : 2), '0').toUpperCase()}`
    }).join('.')
}

/**
 * 解析通配符掩码字符串为 32 位整数
 * 支持多种输入格式：点分十进制、整型、八进制、十六进制、二进制
 */
const parseWildcardToLong = (wildcard: string): number => {
    let wildcardStr = `${wildcard}`.trim()

    // 支持二进制格式输入（如 0b00000000.0b00000000.0b00000000.0b11111111）
    wildcardStr = tryBinaryToDecimal(wildcardStr)

    // 点分格式（十进制/八进制/十六进制，与 IP/掩码输入格式一致）
    if (wildcardStr.includes('.')) {
        const parts = wildcardStr.split('.')
        if (parts.length !== 4) {
            throw new Error('反掩码格式错误：需要 4 段点分格式，如 0.0.63.255')
        }
        let result = 0
        for (const part of parts) {
            let num: number
            const p = part.trim()
            if (p.toLowerCase().startsWith('0x')) {
                // 带前缀的十六进制：0xFF
                num = parseInt(p, 16)
            } else if (p.toLowerCase().startsWith('0b')) {
                // 带前缀的二进制：0b11111111
                num = parseInt(p.substring(2), 2)
            } else if (/^[01]{8}$/.test(p)) {
                // 纯 8 位二进制（无前缀）：00111111
                num = parseInt(p, 2)
            } else if (/^[0-9a-f]+$/i.test(p) && /[a-f]/i.test(p)) {
                // 含十六进制字母的无前缀十六进制：3F、FF
                num = parseInt(p, 16)
            } else if (p.length > 1 && p.startsWith('0') && !p.includes('8') && !p.includes('9')) {
                // 八进制：0377
                num = parseInt(p, 8)
            } else {
                num = parseInt(p, 10)
            }
            if (isNaN(num) || num < 0 || num > 255) {
                throw new Error(`反掩码值无效：每段需为 0-255，当前输入 "${p}"`)
            }
            result = (result << 8) | num
        }
        return result >>> 0
    }

    // 整型格式
    const longVal = parseInt(wildcardStr, 10)
    if (!isNaN(longVal) && longVal >= 0 && longVal <= 0xFFFFFFFF) {
        return longVal >>> 0
    }

    throw new Error('反掩码格式错误：支持点分十进制（如 0.0.63.255）、整型、八进制、十六进制、二进制')
}

/**
 * 通配符掩码（反掩码）转子网掩码
 * 支持多种输入格式：点分十进制、整型、八进制、十六进制、二进制
 * 例：0.0.63.255 → 255.255.192.0
 */
export const wildcardToMask = (wildcard: string): string => {
    const wildcardLong = parseWildcardToLong(wildcard)
    return long2ip((~wildcardLong) >>> 0)
}

/**
 * 判断通配符掩码是否为连续的（即取反后是合法子网掩码）
 * 合法子网掩码：二进制中 1 全部在高位连续排列，0 全部在低位
 */
export const isContiguousWildcard = (wildcard: string): boolean => {
    const wildcardLong = parseWildcardToLong(wildcard)
    const maskLong = (~wildcardLong) >>> 0
    // 合法子网掩码：mask + (mask 最低位的 1 对应的值) 应该是 2 的幂或为 0
    // 即 maskLong 的二进制形如 1...10...0
    if (maskLong === 0) return true
    const inverted = (~maskLong) >>> 0
    return (inverted & (inverted + 1)) === 0
}

/**
 * 获取通配符掩码的各种格式信息
 */
export const getWildcardInfo = (wildcard: string) => {
    const wildcardLong = parseWildcardToLong(wildcard)
    const wip = long2ip(wildcardLong)
    return {
        mask: wip,
        long: `${wildcardLong}`,
        mask2: ipConvert(wip, 2),
        mask8: ipConvert(wip, 8),
        mask16: ipConvert(wip, 16),
    }
}

/**
 * 非连续通配符掩码计算器
 * 通配符规则：0 位必须与给定 IP 完全匹配，1 位可以是任意值
 */
export class WildcardCalc {
    private ipLong: number
    private wildcardLong: number
    ip: string

    constructor(ipAddr: string, wildcard: string) {
        // 支持二进制格式
        ipAddr = tryBinaryToDecimal(ipAddr)
        this.ip = `${long2ip(ip2long(ipAddr))}`
        this.ipLong = ip2long(ipAddr) >>> 0
        this.wildcardLong = parseWildcardToLong(wildcard)
    }

    // 通配位数（通配符中 1 的个数）
    wildcardBits(): number {
        let count = 0
        let n = this.wildcardLong
        while (n) {
            count += n & 1
            n >>>= 1
        }
        return count
    }

    // 匹配地址总数
    matchCount(): number {
        return 2**this.wildcardBits()
    }

    // 固定位模板（IP 与通配符掩码的 AND 取反结果，即 IP 中固定位的值）
    private fixedBits(): number {
        return (this.ipLong & (~this.wildcardLong >>> 0)) >>> 0
    }

    // 第一个匹配地址（所有通配位设为 0）
    firstMatch(): string {
        return long2ip(this.fixedBits())
    }

    // 最后一个匹配地址（所有通配位设为 1）
    lastMatch(): string {
        return long2ip((this.fixedBits() | this.wildcardLong) >>> 0)
    }

    // 匹配模式描述（如 192.42.[64-127].[0-63]）
    matchPattern(): string {
        const parts: string[] = []
        for (let i = 3; i >= 0; i--) {
            const ipByte = (this.ipLong >>> (i * 8)) & 0xFF
            const wcByte = (this.wildcardLong >>> (i * 8)) & 0xFF
            if (wcByte === 0) {
                // 整个字节固定
                parts.push(`${ipByte}`)
            } else if (wcByte === 255) {
                // 整个字节通配
                parts.push('0-255')
            } else {
                // 部分位通配：计算该字节的最小和最大匹配值
                const fixedPart = ipByte & (~wcByte & 0xFF)
                const minVal = fixedPart
                const maxVal = fixedPart | wcByte
                parts.push(`${minVal}-${maxVal}`)
            }
        }
        return parts.join('.')
    }

    // IP 信息
    ipInfo() {
        return {
            ip: this.ip,
            long: `${this.ipLong}`,
            ip2: ipConvert(this.ip, 2),
            ip8: ipConvert(this.ip, 8),
            ip16: ipConvert(this.ip, 16),
        }
    }
}

export const getMaskBitByAvailable = (available: number) => {
    if (isNaN(available) || available > 0xFFFFFFFE || available < 1) {
        throw new Error(`Available Size Invalid`)
    }
    let bitSize = parseInt(`${Math.log(available) / Math.log(2)}`) + 1;
    if ((2**bitSize - available) < 2) {
        bitSize += 1;
    }
    return 32 - bitSize

}

export default class {
    netmask: Netmask
    ip = ""

    constructor(
        ipAddr = "192.168.0.1" // lang/点分[10/8/16]进制
        , maskAddr = "24" // 位数/lang/点分[10/8/16]进制
    ) {
        // mask long
        if (!`${maskAddr}`.includes('.') && parseInt(`${maskAddr}`, 10) > 32) {
            maskAddr = long2ip(parseInt(`${maskAddr}`, 10))
        }

        // ip/mask 支持二进制
        ipAddr = tryBinaryToDecimal(ipAddr)
        maskAddr = tryBinaryToDecimal(maskAddr)

        this.netmask = new Netmask(`${ipAddr}/${maskAddr}`)
        this.ip = `${long2ip(ip2long(ipAddr))}`
    }

    // 可用地址
    available() {
        return Math.max(this.netmask.size - 2, 0)
    }

    // 地址总数
    size() {
        return this.netmask.size
    }

    // 网络
    base() {
        return this.netmask.base
    }

    first() {
        return this.netmask.first
    }

    last() {
        return this.netmask.last
    }

    broadcast() {
        return this.netmask.broadcast || "-"
    }

    // 当前ip
    ipInfo() {
        return {
            ip: this.ip,
            long: `${ip2long(this.ip)}`,
            ip2: ipConvert(this.ip, 2),
            ip8: ipConvert(this.ip, 8),
            ip16: ipConvert(this.ip, 16),
        }
    }

    // 当前掩码
    maskInfo() {
        const mask = `${long2ip(this.netmask.maskLong)}`;
        return {
            bit: `${this.netmask.bitmask}`,
            long: `${this.netmask.maskLong}`,
            mask,
            mask2: ipConvert(mask, 2),
            mask8: ipConvert(mask, 8),
            mask16: ipConvert(mask, 16),
            opposite: `${this.netmask.hostmask}`,
        }
    }
}
