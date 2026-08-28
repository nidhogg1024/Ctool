import platform from "./platform"
import {getFullPageUrl} from "./fullPageUrl"

export const openUrl = (url: string = getFullPageUrl(window.location.href)) => {
    platform.runtime.openUrl(url)
}

export const optionMap = (items: string[] | number[], prefix = "") => {
    return items.map((item: string | number) => {
        return {value: item, label: $t(`${prefix}${item}`)}
    })
}
