import { ExtData, decode, encode } from "@msgpack/msgpack";
import Serialize from "@/helper/serialize";
import Text from "@/helper/text";

const binaryToObject = (value: Uint8Array) => {
    const text = Text.fromUint8Array(value);
    return {
        $type: "binary",
        hex: text.toHexString(),
        base64: text.toBase64(),
    };
};

const extDataToBinaryObject = (value: Uint8Array | ((pos: number) => Uint8Array)) => {
    return binaryToObject(typeof value === "function" ? value(0) : value);
};

export const normalizeDecodedValue = (value: unknown): unknown => {
    if (value instanceof Uint8Array) {
        return binaryToObject(value);
    }

    if (value instanceof ExtData) {
        return {
            $type: "extension",
            extType: value.type,
            data: extDataToBinaryObject(value.data),
        };
    }

    if (value instanceof Date) {
        return {
            $type: "date",
            value: value.toISOString(),
        };
    }

    if (Array.isArray(value)) {
        return value.map(item => normalizeDecodedValue(item));
    }

    if (value !== null && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(([key, item]) => {
                return [key, normalizeDecodedValue(item)];
            }),
        );
    }

    return value;
};

export const encodeMsgpack = (data: Serialize): Text => {
    if (data.isEmpty()) {
        return Text.empty();
    }

    if (data.isError()) {
        return Text.fromError(data.error());
    }

    try {
        return Text.fromUint8Array(
            encode(data.content(), {
                useBigInt64: true,
            }),
        ).setExtension(".msgpack");
    } catch (e) {
        return Text.fromError($error(e));
    }
};

export const decodeMsgpack = (data: Text): Serialize => {
    if (data.isEmpty()) {
        return Serialize.empty();
    }

    if (data.isError()) {
        return Serialize.fromError(data.toString());
    }

    try {
        const decoded = decode(data.toUint8Array(), {
            useBigInt64: true,
        });
        const normalized = normalizeDecodedValue(decoded);
        if (normalized !== null && typeof normalized === "object") {
            return Serialize.formObject(normalized as object);
        }
        return Serialize.formObject({ value: normalized });
    } catch (e) {
        return Serialize.fromError($error(e));
    }
};
