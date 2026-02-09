<template>
    <HeightResize v-slot="{ small, large }" :reduce="5">
        <Align direction="vertical">
            <Editor
                v-model="action.current.payload"
                lang="json"
                :height="small"
                :placeholder="$t('jwt_payload_placeholder')"
            >
                <Align>
                    <Select
                        :model-value="action.current.algorithm"
                        @change="value => action.current.algorithm = value"
                        :options="algorithmOptions"
                    />
                    <Input
                        v-model="action.current.secret"
                        :placeholder="$t('jwt_secret_placeholder')"
                        :width="200"
                    />
                </Align>
            </Editor>
            <Textarea
                :model-value="output"
                :height="large"
                :placeholder="$t('jwt_output_placeholder')"
                copy
            />
        </Align>
    </HeightResize>
</template>

<script lang="ts" setup>
import { initialize, useAction } from "@/store/action";
import { watch } from "vue";

type Algorithm = "HS256" | "HS384" | "HS512";

const algorithmOptions = [
    { value: "HS256", label: "HS256" },
    { value: "HS384", label: "HS384" },
    { value: "HS512", label: "HS512" },
];

// 算法名到 Web Crypto API 的 hash 名映射
const algorithmHashMap: Record<Algorithm, string> = {
    HS256: "SHA-256",
    HS384: "SHA-384",
    HS512: "SHA-512",
};

const action = useAction(
    await initialize(
        {
            payload: "",
            secret: "",
            algorithm: "HS256" as Algorithm,
        },
        { paste: false },
    ),
);

/**
 * Base64URL 编码（JWT 标准要求）
 * 与标准 Base64 的区别：+ → -，/ → _，去掉末尾 =
 */
const base64UrlEncode = (data: string | ArrayBuffer): string => {
    let bytes: Uint8Array;
    if (typeof data === "string") {
        bytes = new TextEncoder().encode(data);
    } else {
        bytes = new Uint8Array(data);
    }
    let binary = "";
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/**
 * 使用 Web Crypto API 进行 HMAC 签名
 */
const sign = async (algorithm: Algorithm, secret: string, data: string): Promise<string> => {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
        "raw",
        enc.encode(secret),
        { name: "HMAC", hash: algorithmHashMap[algorithm] },
        false,
        ["sign"],
    );
    const signature = await crypto.subtle.sign("HMAC", key, enc.encode(data));
    return base64UrlEncode(signature);
};

/**
 * 生成 JWT token
 */
const generateJwt = async (algorithm: Algorithm, payload: string, secret: string): Promise<string> => {
    // 构造 header
    const header = JSON.stringify({ alg: algorithm, typ: "JWT" });
    const encodedHeader = base64UrlEncode(header);

    // 编码 payload（先解析验证是否为合法 JSON，再编码原始内容以保留格式）
    JSON.parse(payload);
    const encodedPayload = base64UrlEncode(payload);

    // 签名
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const signature = await sign(algorithm, secret, signingInput);

    return `${signingInput}.${signature}`;
};

let output = $ref("");

watch(
    () => ({
        payload: action.current.payload,
        secret: action.current.secret,
        algorithm: action.current.algorithm,
    }),
    async ({ payload, secret, algorithm }) => {
        output = "";
        const trimmed = payload.trim();
        if (!trimmed || !secret) {
            return;
        }
        try {
            output = await generateJwt(algorithm as Algorithm, trimmed, secret);
            action.save();
        } catch (e) {
            output = $error(e);
        }
    },
    { immediate: true, deep: true },
);
</script>
