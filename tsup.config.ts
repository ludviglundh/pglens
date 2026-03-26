import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server/cli.ts"],
  format: ["esm"],
  target: "node22",
  outDir: "dist",
  clean: true,
  noExternal: [],
  external: ["postgres", "@hono/node-server"],
  banner: {
    js: "#!/usr/bin/env node",
  },
});
