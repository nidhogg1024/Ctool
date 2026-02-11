<template>
    <Align horizontal="center" class="ctool-page-option" :bottom="'default'">
        <Input size="large" :width="300" v-model="action.current.input" :label="$t('ipcalc_ip')">
            <template #suffix>
                <HelpTip @click="help = true" icon="info" :text="$t('ipcalc_format')"/>
            </template>
        </Input>
        <Select size="large" v-model="action.current.maskMode" :options="[
            {label: $t('ipcalc_mask'), value: 'mask'},
            {label: $t('ipcalc_wildcard'), value: 'wildcard'},
        ]"/>
        <Input size="large" :width="220" v-model="action.current.mask">
            <template v-if="action.current.maskMode === 'mask'" #append>
                <Button @click="maskSetShow = true">
                    <Icon hover name="setting" :tooltip="$t('ipcalc_mask_set_title')"/>
                </Button>
            </template>
            <template #suffix>
                <HelpTip @click="help = true" icon="info" :text="$t('ipcalc_format')"/>
            </template>
        </Input>
        <HelpTip link="https://www.npmjs.com/package/netmask"/>
    </Align>
    <!-- 连续通配符 或 掩码模式：显示标准结果 -->
    <Align direction="vertical" v-if="error === '' && !nonContiguous">
        <Card :title="$t('ipcalc_ip_info')" padding="0">
            <div style="display: grid;grid-template-columns: 1fr 1fr 1fr;">
                <Item :title="$t(`ipcalc_ip_info_ip10`)" :value="calc.ipInfo().ip"/>
                <Item :title="$t(`ipcalc_ip_info_long`)" :value="calc.ipInfo().long"/>
                <Item :title="$t(`ipcalc_ip_info_ip8`)" :value="calc.ipInfo().ip8"/>
                <Item :title="$t(`ipcalc_ip_info_ip16`)" :value="calc.ipInfo().ip16"/>
                <Item :title="$t(`ipcalc_ip_info_ip2`)" :value="calc.ipInfo().ip2" style="grid-column-start: 2;grid-column-end: 4;"/>
            </div>
            <template #extra>{{ action.current.input }}</template>
        </Card>
        <Card :title="action.current.maskMode === 'wildcard' ? $t('ipcalc_wildcard_info') : $t('ipcalc_mask_info')" padding="0">
            <div style="display: grid;grid-template-columns: 1fr 1fr 1fr 1fr;">
                <Item :title="$t(`ipcalc_mask`)" :value="calc.maskInfo().bit"/>
                <Item :title="$t(`ipcalc_mask_info_mask`)" :value="calc.maskInfo().mask"/>
                <Item :title="$t(`ipcalc_mask_info_long`)" :value="calc.maskInfo().long"/>
                <Item :title="$t(`ipcalc_mask_info_opposite`)" :value="calc.maskInfo().opposite"/>
                <Item :title="$t(`ipcalc_mask_info_mask8`)" :value="calc.maskInfo().mask8"/>
                <Item :title="$t(`ipcalc_mask_info_mask16`)" :value="calc.maskInfo().mask16"/>
                <Item :title="$t(`ipcalc_mask_info_mask2`)" :value="calc.maskInfo().mask2" style="grid-column-start: 3;grid-column-end: 5;"/>
            </div>
            <!-- 反掩码模式额外显示反掩码格式 -->
            <template v-if="action.current.maskMode === 'wildcard'">
                <div style="border-top: 1px solid var(--ctool-border-color);display: grid;grid-template-columns: 1fr 1fr 1fr 1fr;">
                    <Item :title="$t(`ipcalc_wildcard_info_mask`)" :value="wildcardDetail.mask"/>
                    <Item :title="$t(`ipcalc_wildcard_info_long`)" :value="wildcardDetail.long"/>
                    <Item :title="$t(`ipcalc_wildcard_info_mask8`)" :value="wildcardDetail.mask8"/>
                    <Item :title="$t(`ipcalc_wildcard_info_mask16`)" :value="wildcardDetail.mask16"/>
                    <Item :title="$t(`ipcalc_wildcard_info_mask2`)" :value="wildcardDetail.mask2" style="grid-column-start: 2;grid-column-end: 5;"/>
                </div>
            </template>
            <template #extra>{{ action.current.mask }}</template>
        </Card>
        <Card :title="$t('ipcalc_network_info')" padding="0">
            <div style="display: grid;grid-template-columns: 1fr 1fr 1fr;">
                <Item :title="$t(`ipcalc_network_info_available`)" :value="calc.available()"/>
                <Item :title="$t(`ipcalc_network_info_size`)" :value="calc.size()"/>
                <Item :title="$t(`ipcalc_network_info_base`)" :value="calc.base()"/>
                <Item :title="$t(`ipcalc_network_info_first`)" :value="calc.first()"/>
                <Item :title="$t(`ipcalc_network_info_last`)" :value="calc.last()"/>
                <Item :title="$t(`ipcalc_network_info_broadcast`)" :value="calc.broadcast()"/>
            </div>
            <template #extra>
                <Button type="primary" size="small" :text="$t(`ipcalc_subnet`)" @click="showSubnet = true"/>
            </template>
        </Card>
    </Align>
    <!-- 非连续通配符：专用结果面板 -->
    <Align direction="vertical" v-if="error === '' && nonContiguous">
        <Card :title="$t('ipcalc_ip_info')" padding="0">
            <div style="display: grid;grid-template-columns: 1fr 1fr 1fr;">
                <Item :title="$t(`ipcalc_ip_info_ip10`)" :value="wildcardCalc.ipInfo().ip"/>
                <Item :title="$t(`ipcalc_ip_info_long`)" :value="wildcardCalc.ipInfo().long"/>
                <Item :title="$t(`ipcalc_ip_info_ip8`)" :value="wildcardCalc.ipInfo().ip8"/>
                <Item :title="$t(`ipcalc_ip_info_ip16`)" :value="wildcardCalc.ipInfo().ip16"/>
                <Item :title="$t(`ipcalc_ip_info_ip2`)" :value="wildcardCalc.ipInfo().ip2" style="grid-column-start: 2;grid-column-end: 4;"/>
            </div>
            <template #extra>{{ action.current.input }}</template>
        </Card>
        <Card :title="`${$t('ipcalc_wildcard_info')} (${$t('ipcalc_wildcard_noncontiguous')})`" padding="0">
            <div style="display: grid;grid-template-columns: 1fr 1fr 1fr 1fr;">
                <Item :title="$t(`ipcalc_wildcard_info_mask`)" :value="wildcardDetail.mask"/>
                <Item :title="$t(`ipcalc_wildcard_info_long`)" :value="wildcardDetail.long"/>
                <Item :title="$t(`ipcalc_wildcard_info_mask8`)" :value="wildcardDetail.mask8"/>
                <Item :title="$t(`ipcalc_wildcard_info_mask16`)" :value="wildcardDetail.mask16"/>
                <Item :title="$t(`ipcalc_wildcard_info_mask2`)" :value="wildcardDetail.mask2" style="grid-column-start: 2;grid-column-end: 5;"/>
            </div>
            <template #extra>{{ action.current.mask }}</template>
        </Card>
        <Card :title="$t('ipcalc_wildcard_match')" padding="0">
            <div style="display: grid;grid-template-columns: 1fr 1fr 1fr;">
                <Item :title="$t(`ipcalc_wildcard_match_count`)" :value="wildcardCalc.matchCount()"/>
                <Item :title="$t(`ipcalc_wildcard_match_bits`)" :value="wildcardCalc.wildcardBits()"/>
                <Item :title="$t(`ipcalc_wildcard_match_pattern`)" :value="wildcardCalc.matchPattern()"/>
                <Item :title="$t(`ipcalc_wildcard_match_first`)" :value="wildcardCalc.firstMatch()"/>
                <Item :title="$t(`ipcalc_wildcard_match_last`)" :value="wildcardCalc.lastMatch()"/>
            </div>
        </Card>
    </Align>
    <HeightResize :append="['.ctool-page-option']" v-if="error !== ''">
        <Exception :content="error"/>
    </HeightResize>
    <Modal :title="$t('ipcalc_format')" v-model="help" width="98%" footer-type="normal">
        <Align direction="vertical">
            <Card :title="$t('ipcalc_ip')" padding="0">
                <div style="display: grid;grid-template-columns: 1fr 1fr 1fr;">
                    <Item :title="$t(`ipcalc_ip_info_ip10`)" value="192.168.0.1"/>
                    <Item :title="$t(`ipcalc_ip_info_long`)" value="3232235521"/>
                    <Item :title="$t(`ipcalc_ip_info_ip8`)" value="0300.0250.0000.0001"/>
                    <Item :title="$t(`ipcalc_ip_info_ip16`)" value="0xC0.0xA8.0x00.0x01"/>
                    <Item :title="$t(`ipcalc_ip_info_ip2`)" value="0b11000000.0b10101000.0b00000000.0b00000001" style="grid-column-start: 2;grid-column-end: 4;"/>
                </div>
            </Card>
            <Card :title="$t('ipcalc_mask')" padding="0">
                <div style="display: grid;grid-template-columns: 8fr 8fr 10fr 10fr;">
                    <Item :title="$t(`ipcalc_mask`)" value="24"/>
                    <Item :title="$t(`ipcalc_mask_info_long`)" value="4294967040"/>
                    <Item :title="$t(`ipcalc_mask_info_mask16`)" value="0xFF.0xFF.0xFF.0x00"/>
                    <Item :title="$t(`ipcalc_mask_info_mask8`)" value="0377.0377.0377.0000"/>
                    <Item :title="$t(`ipcalc_mask_info_mask`)" value="255.255.255.0"/>
                    <Item :title="$t(`ipcalc_mask_info_mask2`)" value="0b11111111.0b11111111.0b11111111.0b00000000" style="grid-column-start: 2;grid-column-end: 5;"/>
                </div>
            </Card>
            <Card :title="$t('ipcalc_wildcard')" padding="0">
                <div style="display: grid;grid-template-columns: 8fr 8fr 10fr 10fr;">
                    <Item :title="$t(`ipcalc_mask_info_mask`)" value="0.0.0.255"/>
                    <Item :title="$t(`ipcalc_mask_info_long`)" value="255"/>
                    <Item :title="$t(`ipcalc_mask_info_mask16`)" value="0x00.0x00.0x00.0xFF"/>
                    <Item :title="$t(`ipcalc_mask_info_mask8`)" value="0000.0000.0000.0377"/>
                    <Item :title="$t(`ipcalc_mask_info_mask2`)" value="0b00000000.0b00000000.0b00000000.0b11111111" style="grid-column-start: 2;grid-column-end: 5;"/>
                </div>
            </Card>
        </Align>
    </Modal>
    <ExtendPage v-model="showSubnet">
        <Card :title="`${action.current.input} ${$t('ipcalc_subnet')}`" padding="0">
            <HeightResize v-slot="{height}" :reduce="35">
                <SerializeOutput
                    disabledBorder
                    v-model="action.current.subnetOption"
                    :allow="['json','xml','yaml','toml','php_array','properties','text']"
                    :content="subnet"
                    :height="height"
                />
            </HeightResize>
            <template #extra>
                <Align>
                    <Input size="small" :width="200" v-model="action.current.mask" :label="$t('ipcalc_mask')">
                        <template #append>
                            <Button @click="maskSetShow = true">
                                <Icon hover name="setting" :tooltip="$t('ipcalc_mask_set_title')"/>
                            </Button>
                        </template>
                        <template #suffix>
                            <HelpTip @click="help = true" icon="info" :text="$t('ipcalc_format')"/>
                        </template>
                    </Input>
                </Align>
            </template>
        </Card>
    </ExtendPage>
    <Modal :title="$t('ipcalc_mask_set_title')" v-model="maskSetShow" footer-type="long" @ok="maskSet">
        <InputNumber size="large" v-model="maskAvailable" :label="$t('ipcalc_network_info_available')"/>
    </Modal>
</template>

<script lang="ts" setup>
import {initialize, useAction} from "@/store/action";
import ipcalc, {getMaskBitByAvailable, wildcardToMask, isContiguousWildcard, getWildcardInfo, WildcardCalc} from "./utilV4";
import {watch} from "vue";
import Item from "./Item.vue";
import Serialize from "@/helper/serialize";
import {createSerializeOutput} from "@/components/serialize";

const action = useAction(await initialize({
    input: "192.168.0.1",
    mask: "24",
    maskMode: "mask",
    subnetOption: createSerializeOutput("text")
}, {
    paste: (input) => /^(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])$/.test(input)
}))

let help = $ref(false)
let maskSetShow = $ref(false)
let maskAvailable = $ref(254)
let error = $ref("")
let calc = $ref(new ipcalc())
let showSubnet = $ref(false)
// 非连续通配符相关状态
let nonContiguous = $ref(false)
let wildcardCalc = $ref(new WildcardCalc("0.0.0.0", "0.0.0.0"))
let wildcardDetail = $ref(getWildcardInfo("0.0.0.0"))

const subnet = $computed(() => {
    const lists: string[] = []
    calc.netmask.forEach((ip) => {
        lists.push(ip)
    })
    return Serialize.formObject(lists)
})

const maskSet = () => {
    action.current.mask = `${getMaskBitByAvailable(maskAvailable)}`
    maskSetShow = false
}
watch(() => {
    return {
        input: action.current.input,
        mask: action.current.mask,
        maskMode: action.current.maskMode,
    }
}, ({input, mask, maskMode}) => {
    error = ""
    nonContiguous = false
    try {
        if (maskMode === "wildcard") {
            const effectiveWildcard = mask || "0.0.0.0"
            // 获取反掩码各种格式信息
            wildcardDetail = getWildcardInfo(effectiveWildcard)
            if (!isContiguousWildcard(effectiveWildcard)) {
                // 非连续通配符：使用专用计算器
                nonContiguous = true
                wildcardCalc = new WildcardCalc(input, effectiveWildcard)
            } else {
                // 连续通配符：转为子网掩码走标准逻辑
                const effectiveMask = wildcardToMask(effectiveWildcard)
                calc = new ipcalc(input, effectiveMask)
            }
        } else {
            calc = new ipcalc(input, mask)
        }
        action.save()
    } catch (e) {
        error = $error(e)
    }
}, {immediate: true})
</script>
