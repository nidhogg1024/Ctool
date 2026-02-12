<template>
    <HeightResize v-slot="{height}" ignore :reduce="5">
        <Align direction="vertical">
            <div v-row="`1-1`">
                <Editor
                    v-model="action.current.input"
                    lang="sql"
                    :height="height/2"
                    :placeholder="`Sql: SELECT * FROM T WHERE id=? AND name=?`"
                />
                <Textarea
                    v-model="action.current.params"
                    :height="height/2"
                    :placeholder="`${$t('sqlFillParameter_parameter')}:\n?模式: 1(Integer),zhangshan(String)\n具名模式: id=1(Integer),name=zhangshan(String)`"
                    :copy="$t('sqlFillParameter_parameter')"
                />
            </div>
            <Editor
                :model-value="output"
                lang="sql"
                :height="height/2"
                :placeholder="`${$t('main_ui_output')}: SELECT * FROM T WHERE id=1 AND name='zhangshan'`"
            />
        </Align>
    </HeightResize>
</template>

<script lang="ts" setup>
import {initialize, useAction} from "@/store/action";
import {watch} from "vue";

// 1-String 2-NUMBER 3-Long,4-Timestamp
const TYPE_STR = ['String', 'Integer', 'Long', 'Timestamp']

const action = useAction(await initialize({input: "", params: ""}))

/**
 * 将一行参数转化为值和类型的对象有序列表
 * @param params 参数字符串，字符串的格式为 value(type),value(type),.....
 * 实际例如： 1(String),2023-03-23 12:00:00(Timestamp)
 */
const convertParam = (params: string) => {
    if (params) {
        const tempList = params.split(',', -1)
        // 因为参数中可能存在逗号，例如json数据，为此采取的方案是先分割，后合并的策略
        // 分割后是不包含,的，检查串是否为null或者)结尾，如果是则认为是正常的参数，如果不是则认为是分割后的串的一部分
        // 举例{"goodsService":[],"goodsSpecs":{"id":"db6c56a224a788c5a7458017731c9255","imageFileId":"16925e7fc297452a984d4b3e2e9e6e40"}}(String),
        // null, null, 1(Integer),1(Integer)
        // paramStrList 为合并后的实际参数列表
        const paramStrList:string[] = []
        let paramIndex = 0
        // 标记是否在合并中
        let combining = false
        tempList.forEach((x) => {
            // 对null值采用endsWith的原因是因为有前置空格，直接判断endWith比去掉空格处理更方便
            // 遇到null值直接作为参数
            if (x.endsWith('null')) {
              paramStrList.push(x)
              paramIndex ++
            } else if (x.endsWith(')')) {
                // 前面的串处在合并过程中，遇到了）结尾的情况，说明合并结束
                if (combining) {
                    paramStrList[paramIndex] += ',' + x
                    combining = false
                } else {
                    paramStrList.push(x)
                }
                paramIndex ++
            } else {
                const tempStr = paramStrList[paramIndex]
                if (!tempStr) {
                  paramStrList.push(x)
                  combining= true
                } else {
                  paramStrList[paramIndex] +=  ',' + x
                }
            }
        })
        return paramStrList.map(x => {
            const valueEndIndex = x.lastIndexOf('(')
            if (valueEndIndex < 0) {
                // 直接将整个串作为值，类型为其他
                return {value: x, type: null}
            }
            // 从串中截取出值，并对前后空格进行清除
            let value = x.substring(0, valueEndIndex)
            value = value.trim();
            // 对数据中的'进行转义，mybatis输出的参数中的'是不进行转义的
            value = value.replaceAll('\'', '\\\'')
            // 从串中截取出类型，并进行前后空格清除
            let typeEndIndex = x.lastIndexOf(')')
            if (typeEndIndex < 0) {
                typeEndIndex = x.length
            }
            let type = x.substring(valueEndIndex + 1, typeEndIndex)
            type = type.trim()
            return {value, type}
        })
    } else {
        return []
    }
}

/**
 * 根据参数类型格式化参数值
 */
const formatParamValue = (param: { value: string, type: string | null }) => {
    switch (param.type) {
        case TYPE_STR[0]: // String
            return ' \'' + param.value + '\''
        case TYPE_STR[1]: // Integer
        case TYPE_STR[2]: // Long
            return param.value
        case TYPE_STR[3]: // Timestamp
            return 'Timestamp \'' + param.value + '\''
        default: // 其他类型直接拼接原始值
            return param.value
    }
}

/**
 * 检测 SQL 是否使用具名参数（:name 或 #{name} 格式）
 */
const detectNamedParams = (sql: string): 'positional' | 'colon' | 'mybatis' => {
    // 先检查 #{name} 格式（MyBatis 风格）
    if (/#\{(\w+)\}/.test(sql)) {
        return 'mybatis'
    }
    // 再检查 :name 格式（Spring JDBC / PostgreSQL 风格），排除 :: 类型转换
    // 使用 (^|[^:]) 替代 lookbehind (?<!:) 以兼容旧版 Safari
    if (/(^|[^:]):(\w+)/.test(sql)) {
        return 'colon'
    }
    return 'positional'
}

/**
 * 将参数字符串解析为具名参数 Map
 * 格式：name=value(type),age=value(type)
 */
const convertNamedParam = (params: string): Map<string, { value: string, type: string | null }> => {
    const result = new Map<string, { value: string, type: string | null }>()
    if (!params) return result

    // 按逗号分割，处理值中包含逗号的情况（与 convertParam 类似的合并策略）
    const tempList = params.split(',', -1)
    const paramStrList: string[] = []
    let paramIndex = 0
    let combining = false

    tempList.forEach((x) => {
        if (x.endsWith('null') && x.includes('=')) {
            paramStrList.push(x)
            paramIndex++
        } else if (x.endsWith(')')) {
            if (combining) {
                paramStrList[paramIndex] += ',' + x
                combining = false
            } else {
                paramStrList.push(x)
            }
            paramIndex++
        } else {
            const tempStr = paramStrList[paramIndex]
            if (!tempStr) {
                paramStrList.push(x)
                combining = true
            } else {
                paramStrList[paramIndex] += ',' + x
            }
        }
    })

    paramStrList.forEach(item => {
        const eqIndex = item.indexOf('=')
        if (eqIndex < 0) return
        const name = item.substring(0, eqIndex).trim()
        const rest = item.substring(eqIndex + 1)

        const valueEndIndex = rest.lastIndexOf('(')
        if (valueEndIndex < 0) {
            result.set(name, { value: rest.trim(), type: null })
            return
        }
        let value = rest.substring(0, valueEndIndex).trim()
        value = value.replaceAll('\'', '\\\'')
        const typeEndIndex = rest.lastIndexOf(')')
        const type = rest.substring(valueEndIndex + 1, typeEndIndex < 0 ? rest.length : typeEndIndex).trim()
        result.set(name, { value, type })
    })

    return result
}

const fill = () => {
    if (!action.current.input || !action.current.params) {
        return ""
    }

    const paramStyle = detectNamedParams(action.current.input)

    // 具名参数模式：:name 或 #{name}
    if (paramStyle === 'colon' || paramStyle === 'mybatis') {
        const paramMap = convertNamedParam(action.current.params)
        let result = action.current.input

        if (paramStyle === 'mybatis') {
            // 替换 #{name} 占位符
            result = result.replace(/#\{(\w+)\}/g, (_match, name) => {
                const param = paramMap.get(name)
                if (!param) {
                    throw new Error($t('sqlFillParameter_named_param_missing').replace('{name}', name))
                }
                return formatParamValue(param)
            })
        } else {
            // 替换 :name 占位符，排除 :: 类型转换
            // 使用 (::?) 匹配替代 lookbehind (?<!:) 以兼容旧版 Safari
            result = result.replace(/(::?)(\w+)/g, (_match, prefix, name) => {
                // :: 是 PostgreSQL 类型转换语法，原样保留
                if (prefix === '::') return _match
                const param = paramMap.get(name)
                if (!param) {
                    throw new Error($t('sqlFillParameter_named_param_missing').replace('{name}', name))
                }
                return formatParamValue(param)
            })
        }

        return result
    }

    // 位置参数模式（原有逻辑）：?
    const paramList = convertParam(action.current.params)
    const tempSqlStr = action.current.input
    let resultStr = ''
    let paramIndex = 0
    for (let i = 0; i < tempSqlStr.length; i++) {
        const c = tempSqlStr.charAt(i)
        if (c === '?') {
            if (paramList.length <= paramIndex) {
                throw new Error($t('sqlFillParameter_parameter_too_little'))
            }
            resultStr += formatParamValue(paramList[paramIndex])
            paramIndex++
        } else {
            resultStr += c
        }
    }
    return resultStr
}

/**
 * 从串中分离sql模板和参数
 */
const splitSqlAndParams = (input: string) => {
    const result = {
        sql: "",
        params: ""
    }
    // 寻找SQL串的开始
    const sqlStartStr = 'Preparing:'
    let sqlStartIndex = input.indexOf(sqlStartStr)
    if (sqlStartIndex < 0) {
        // 没有找到Preparing:则认为整个串是SQL
        sqlStartIndex = 0
    } else {
        sqlStartIndex += sqlStartStr.length
    }
    // mybatis打印的SQL都以行为结束标记，因此寻找到该行的\n即认为结束
    let sqlEndIndex = input.indexOf("\n", sqlStartIndex)
    if (sqlEndIndex < 0) {
        sqlEndIndex = input.length
    }
    result.sql = input.substring(sqlStartIndex, sqlEndIndex)
    // 寻找参数串的开始
    const paramStartStr = 'Parameters:'
    const paramStartIndex = input.indexOf(paramStartStr)
    if (paramStartIndex >= 0) {
        // mybatis打印的SQL都以行为结束标记，因此寻找到该行的\n即认为结束
        let paramEndIndex = input.indexOf("\n", paramStartIndex)
        if (paramEndIndex < 0) {
            paramEndIndex = input.length
        }
        result.params = input.substring(paramStartIndex + paramStartStr.length, paramEndIndex)
    }
    return result
}

const output = $computed(() => {
    try {
        if (!action.current.input || !action.current.params) {
            return ""
        }
        // 做参数填充
        const resultStr = fill()
        action.save()
        return resultStr
    } catch (e) {
        return $error(e)
    }
})

watch(() => {
    return {input: action.current.input, params: action.current.params}
}, ({input}) => {
    // 输入不为空，且输入包含Preparing:和Parameters:，则尝试分离SQL和参数
    if (
        input !== ""
        && input.includes('Preparing:')
        && input.includes('Parameters:')
    ) {
        const result = splitSqlAndParams(input)
        if (result.sql !== "" && result.params !== "") {
            setTimeout(() => {
                action.current.input = result.sql
                action.current.params = result.params
            })
        }
    }
}, {immediate: true})
</script>
