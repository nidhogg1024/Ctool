// 跨工具数据传递（临时中转，不持久化）
import { defineStore } from '@/helper/pinia'
import { ref } from 'vue'

export default defineStore('transfer', () => {
    const data = ref('')
    const sourceFormat = ref('json')

    // 设置传递数据
    const set = (content: string, format: string = 'json') => {
        data.value = content
        sourceFormat.value = format
    }

    // 消费传递数据（读取后清空，一次性使用）
    const consume = () => {
        const result = { data: data.value, sourceFormat: sourceFormat.value }
        data.value = ''
        sourceFormat.value = 'json'
        return result
    }

    const hasData = () => data.value !== ''

    return { data, sourceFormat, set, consume, hasData }
}, false) // 不持久化
