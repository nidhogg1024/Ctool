import { defineWranglerConfig } from "wrangler/experimental-config";

export default defineWranglerConfig({
    assetsDirectory: "../../ctool-core/dist",
    dev: { types: { generate: false } },
});
