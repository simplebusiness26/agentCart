import {defineConfig} from "vitest/config";

export default defineConfig({
  test:{
    environment:"node",
    include:["tests/**/*.test.ts"],
    // node:sqlite emits an ExperimentalWarning on import; it is expected.
    silent:false
  }
});
