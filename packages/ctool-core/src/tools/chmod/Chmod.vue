<template>
    <Align direction="vertical">
        <!-- 权限矩阵：行=rwx，列=owner/group/others -->
        <Card padding="0">
            <div class="chmod-matrix">
                <div class="chmod-cell chmod-corner"></div>
                <div class="chmod-cell chmod-col-header">{{ $t('chmod_owner') }} (u)</div>
                <div class="chmod-cell chmod-col-header">{{ $t('chmod_group') }} (g)</div>
                <div class="chmod-cell chmod-col-header">{{ $t('chmod_others') }} (o)</div>

                <div class="chmod-cell chmod-row-header">{{ $t('chmod_read') }} (4)</div>
                <div class="chmod-cell"><Bool v-model="matrix[0][0]" /></div>
                <div class="chmod-cell"><Bool v-model="matrix[1][0]" /></div>
                <div class="chmod-cell"><Bool v-model="matrix[2][0]" /></div>

                <div class="chmod-cell chmod-row-header">{{ $t('chmod_write') }} (2)</div>
                <div class="chmod-cell"><Bool v-model="matrix[0][1]" /></div>
                <div class="chmod-cell"><Bool v-model="matrix[1][1]" /></div>
                <div class="chmod-cell"><Bool v-model="matrix[2][1]" /></div>

                <div class="chmod-cell chmod-row-header">{{ $t('chmod_execute') }} (1)</div>
                <div class="chmod-cell"><Bool v-model="matrix[0][2]" /></div>
                <div class="chmod-cell"><Bool v-model="matrix[1][2]" /></div>
                <div class="chmod-cell"><Bool v-model="matrix[2][2]" /></div>
            </div>
        </Card>
        <!-- 特殊权限位 -->
        <Card :title="$t('chmod_special')" padding="0">
            <Align horizontal="center" style="padding: 10px 0;">
                <Bool v-model="special[0]" :label="$t('chmod_suid') + ' (4)'" size="small" border />
                <Bool v-model="special[1]" :label="$t('chmod_sgid') + ' (2)'" size="small" border />
                <Bool v-model="special[2]" :label="$t('chmod_sticky') + ' (1)'" size="small" border />
            </Align>
        </Card>
        <!-- 八进制 -->
        <Card padding="0">
            <div class="chmod-display" @click="$copy(octalStr)">
                <div class="chmod-big-text">{{ octalStr }}</div>
                <div class="chmod-display-label">{{ $t('chmod_octal') }}</div>
            </div>
        </Card>
        <!-- 符号表示 -->
        <Card padding="0">
            <div class="chmod-display" @click="$copy(symbolic)">
                <div class="chmod-big-text">{{ symbolic }}</div>
                <div class="chmod-display-label">{{ $t('chmod_symbolic') }}</div>
            </div>
        </Card>
        <!-- 命令示例 -->
        <Card padding="0">
            <div class="chmod-display" @click="$copy(command)">
                <div class="chmod-display-label">{{ $t('chmod_command') }}</div>
                <div class="chmod-command-text">{{ command }}</div>
            </div>
        </Card>
    </Align>
</template>

<script lang="ts" setup>
import { watch } from "vue";
import { initialize, useAction } from "@/store/action";

const action = useAction(await initialize({
    matrix: [
        [true, true, true],
        [true, false, true],
        [true, false, true],
    ],
    special: [false, false, false],
}));

let matrix = $ref(action.current.matrix);
let special = $ref(action.current.special);

// 八进制
const octalStr = $computed(() => {
    const sp = (special[0] ? 4 : 0) + (special[1] ? 2 : 0) + (special[2] ? 1 : 0);
    const o = (matrix[0][0] ? 4 : 0) + (matrix[0][1] ? 2 : 0) + (matrix[0][2] ? 1 : 0);
    const g = (matrix[1][0] ? 4 : 0) + (matrix[1][1] ? 2 : 0) + (matrix[1][2] ? 1 : 0);
    const t = (matrix[2][0] ? 4 : 0) + (matrix[2][1] ? 2 : 0) + (matrix[2][2] ? 1 : 0);
    return sp > 0 ? `${sp}${o}${g}${t}` : `${o}${g}${t}`;
});

// 符号表示
const symbolic = $computed(() => {
    const s = (r: boolean, w: boolean, x: boolean, sc: string, i: number) => {
        let str = r ? "r" : "-";
        str += w ? "w" : "-";
        if (special[i]) {
            str += x ? sc.toLowerCase() : sc.toUpperCase();
        } else {
            str += x ? "x" : "-";
        }
        return str;
    };
    return s(matrix[0][0], matrix[0][1], matrix[0][2], "s", 0)
         + s(matrix[1][0], matrix[1][1], matrix[1][2], "s", 1)
         + s(matrix[2][0], matrix[2][1], matrix[2][2], "t", 2);
});

// 命令示例
const command = $computed(() => `chmod ${octalStr} path`);

// 持久化
watch(() => ({ m: JSON.stringify(matrix), s: JSON.stringify(special) }), () => {
    action.current.matrix = matrix;
    action.current.special = special;
    action.save();
});
</script>

<style scoped>
.chmod-matrix {
    display: grid;
    grid-template-columns: 140px 1fr 1fr 1fr;
}
.chmod-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 14px 16px;
}
.chmod-corner {
    border-bottom: 1px solid var(--ctool-border-color);
    border-right: 1px solid var(--ctool-border-color);
}
.chmod-col-header {
    font-size: .875rem;
    font-weight: bold;
    border-bottom: 1px solid var(--ctool-border-color);
}
.chmod-row-header {
    justify-content: flex-start;
    font-size: .875rem;
    font-weight: bold;
    border-right: 1px solid var(--ctool-border-color);
}
.chmod-display {
    text-align: center;
    padding: 16px;
    cursor: pointer;
}
.chmod-display:hover {
    background-color: var(--primary-focus);
}
.chmod-big-text {
    font-size: 2rem;
    font-weight: bold;
    font-family: monospace;
    color: var(--primary);
    letter-spacing: 2px;
}
.chmod-command-text {
    font-size: 1.125rem;
    font-family: monospace;
    color: var(--ctool-text-color);
}
.chmod-display-label {
    font-size: .75rem;
    color: var(--ctool-placeholder-text-color);
    margin-top: 4px;
}
</style>
