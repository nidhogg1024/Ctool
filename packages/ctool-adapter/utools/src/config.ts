import {FeatureInterface, getTool} from "ctool-config";

export type CustomCmd = {
    type: "regex" | "over"
    minLength?: number
    maxLength?: number
    match?: string
    label?: string
}

export const customCmds = new Map<FeatureInterface, CustomCmd[]>()

customCmds.set(
    getTool('time').getFeature('timestamp'),
    [
        {
            "type": "regex",
            "match": "/(^\\d{5,}$)|(^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?$)/i",
            "minLength": 5,
            "maxLength": 25
        }
    ]
)

customCmds.set(
    getTool('qrCode').getFeature('generate'),
    [
        {
            "type": "over",
            "minLength": 10,
        }
    ]
)

customCmds.set(
    getTool('ip').firstFeature(),
    [
        {
            "type": "regex",
            "match": "/^(?:(?:25[0-5]|2[0-4]\\d|1\\d{2}|[1-9]?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1\\d{2}|[1-9]?\\d)$/",
            "minLength": 7,
            "maxLength": 15
        }
    ]
)

customCmds.set(
    getTool('unicode').getFeature('decoder'),
    [
        {
            "type": "regex",
            "match": "/\\\\u[0-9a-f]{4}/i",
            "minLength": 6
        }
    ]
)
