<template>
    <Align direction="vertical">
        <HeightResize v-slot="{ height }" :reduce="5" :append="['.ctool-page-option']">
            <Textarea :height="height" :model-value="output" :placeholder="$t('main_ui_output')" />
        </HeightResize>
        <Card class="ctool-page-option" padding="0">
            <Align horizontal="center" style="padding: 10px 16px;" direction="vertical">
                <Align horizontal="center">
                    <InputNumber v-model="action.current.length" :width="100" :label="$t('password_length')" :min="4" :max="128" />
                    <InputNumber v-model="action.current.amount" :width="100" :label="$t('password_amount')" :min="1" :max="100" />
                    <Button @click="generate"><Icon name="refresh" /></Button>
                </Align>
                <Align horizontal="center">
                    <Bool v-model="action.current.uppercase" :label="$t('password_uppercase') + ' (A-Z)'" size="small" border />
                    <Bool v-model="action.current.lowercase" :label="$t('password_lowercase') + ' (a-z)'" size="small" border />
                    <Bool v-model="action.current.digits" :label="$t('password_digits') + ' (0-9)'" size="small" border />
                    <Bool v-model="action.current.symbols" :label="$t('password_symbols') + ' (!@#$)'" size="small" border />
                </Align>
                <Align horizontal="center">
                    <Bool v-model="action.current.excludeAmbiguous" :label="$t('password_exclude_ambiguous')" size="small" border />
                    <Bool v-model="action.current.ensureEachType" :label="$t('password_ensure_each_type')" size="small" border />
                </Align>
                <!-- 密码强度 -->
                <Align horizontal="center">
                    <span style="font-size: .75rem; color: var(--ctool-placeholder-text-color);">{{ $t('password_strength') }}:</span>
                    <span :style="{ fontSize: '.875rem', fontWeight: 'bold', color: strengthColor }">{{ strengthLabel }}</span>
                    <div style="width: 120px; height: 6px; border-radius: 3px; background: var(--ctool-border-color); overflow: hidden;">
                        <div :style="{ width: strengthPercent + '%', height: '100%', borderRadius: '3px', background: strengthColor, transition: 'all 0.3s' }"></div>
                    </div>
                </Align>
            </Align>
        </Card>
    </Align>
</template>

<script lang="ts" setup>
import { initialize, useAction } from "@/store/action";
import { onMounted, watch, computed } from "vue";

const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";
const SYMBOLS = "!@#$%^&*()-_=+[]{}|;:,.<>?";
const AMBIGUOUS = "0Oo1lI";

const action = useAction(await initialize({
    length: 16,
    amount: 5,
    uppercase: true,
    lowercase: true,
    digits: true,
    symbols: true,
    excludeAmbiguous: false,
    ensureEachType: true,
    result: [] as string[],
}));

const secureRandom = (max: number): number => {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] % max;
};

const filterAmbiguous = (chars: string): string => {
    return chars.split("").filter(c => !AMBIGUOUS.includes(c)).join("");
};

const generate = () => {
    const opt = action.current;
    // 构建字符池
    let pool = "";
    const pools: string[] = [];
    if (opt.uppercase) { const p = opt.excludeAmbiguous ? filterAmbiguous(UPPER) : UPPER; pool += p; pools.push(p); }
    if (opt.lowercase) { const p = opt.excludeAmbiguous ? filterAmbiguous(LOWER) : LOWER; pool += p; pools.push(p); }
    if (opt.digits) { const p = opt.excludeAmbiguous ? filterAmbiguous(DIGITS) : DIGITS; pool += p; pools.push(p); }
    if (opt.symbols) { pool += SYMBOLS; pools.push(SYMBOLS); }
    if (pool.length === 0) return;

    const results: string[] = [];
    for (let i = 0; i < opt.amount; i++) {
        let pwd: string[] = [];
        // 确保每类至少 1 个
        if (opt.ensureEachType && opt.length >= pools.length) {
            for (const p of pools) {
                pwd.push(p[secureRandom(p.length)]);
            }
        }
        // 填充剩余
        while (pwd.length < opt.length) {
            pwd.push(pool[secureRandom(pool.length)]);
        }
        // Fisher-Yates 洗牌
        for (let j = pwd.length - 1; j > 0; j--) {
            const k = secureRandom(j + 1);
            [pwd[j], pwd[k]] = [pwd[k], pwd[j]];
        }
        results.push(pwd.join(""));
    }
    action.current.result = results;
};

const output = computed(() => action.current.result.join("\n"));

// 密码强度评估
const strengthScore = computed(() => {
    const len = action.current.length;
    let types = 0;
    if (action.current.uppercase) types++;
    if (action.current.lowercase) types++;
    if (action.current.digits) types++;
    if (action.current.symbols) types++;
    if (types === 0) return 0;
    // 简单评分：长度 + 字符类型多样性
    let score = Math.min(len / 4, 5) + types * 1.5;
    if (len >= 16) score += 2;
    if (len >= 24) score += 1;
    return Math.min(score, 10);
});

const strengthPercent = computed(() => strengthScore.value * 10);
const strengthColor = computed(() => {
    const s = strengthScore.value;
    if (s < 3) return "#f56c6c";
    if (s < 5) return "#e6a23c";
    if (s < 8) return "#67c23a";
    return "#409eff";
});
const strengthLabel = computed(() => {
    const s = strengthScore.value;
    if (s < 3) return $t("password_strength_weak");
    if (s < 5) return $t("password_strength_medium");
    if (s < 8) return $t("password_strength_strong");
    return $t("password_strength_very_strong");
});

onMounted(() => { if (action.current.result.length < 1) generate(); });
watch(() => ({
    l: action.current.length, a: action.current.amount,
    u: action.current.uppercase, lo: action.current.lowercase,
    d: action.current.digits, s: action.current.symbols,
    e: action.current.excludeAmbiguous, en: action.current.ensureEachType,
}), () => generate());
watch(() => action.current, (c) => { if (c.result.length > 0) action.save(); }, { deep: true });
</script>
