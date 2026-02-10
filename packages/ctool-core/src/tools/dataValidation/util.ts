import radix from "@/helper/radix";
import {padStart} from "lodash";
import Text from "@/helper/text";
import crcHandle from 'crc';

export type CrcType = keyof typeof crcHandle;
export const crcTypeLists = Object.keys(crcHandle) as CrcType[]

export const bcc = (text: Text) => {
    let result = 0
    text.toHexArray().forEach(item => {
        result ^= parseInt(item, 16);
    })
    return result;
}

export const lrc = (text: Text) => {
    let result = 0
    text.toHexArray().forEach(item => {
        result += parseInt(item, 16);
    })
    return 256 - (result % 256);
}

export const crc = async (text: Text, type: CrcType) => {
    const handle = await import('crc');
    let value = handle[type](text.toBuffer())
    // CRC16 Modbus：库返回的字节序与协议标准相反，需要交换高低字节
    // 例：输入 "01 03 02 01 84"，库返回 0xB7B9，交换后为 0xB9B7（符合标准）
    if (type === 'crc16modbus') {
        value = ((value & 0xFF) << 8) | ((value >> 8) & 0xFF)
    }
    return value
}

export const result = (value: number, type: string) => {
    type = type.toLowerCase()
    if (type === "oct") {
        return radix(value, 10, 8)
    }
    if (type === "hex") {
        const temp = radix(value, 10, 16)
        return padStart(temp, Math.ceil(temp.length / 2) * 2, "0")
    }
    if (type === "bin") {
        const temp = radix(value, 10, 2)
        return padStart(temp, Math.ceil(temp.length / 8) * 8, "0")
    }
    return `${value}`
}
