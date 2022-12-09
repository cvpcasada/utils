import type { Options } from "tsup";

const env = process.env.NODE_ENV;

export const tsup: Options = {
  sourcemap: env === "prod", 
  clean: true,
  dts: true,
  splitting: false,
  format: ["cjs", "esm"],
  minify: env === "production",
  bundle: env === "production",
  watch: env === "development",
  outDir: env === "production" ? "dist" : "lib",
  entry: {
    index: "src/index.ts",
    react: "src/react/index.ts",
    remeda: "src/remeda/index.ts",
    jotai: "src/jotai/index.ts",
  },
};
