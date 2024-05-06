import fs from "node:fs";
import path from "node:path";

import { defineConfig } from "tsup";

const env = process.env.NODE_ENV;

export default defineConfig({
  sourcemap: env === "prod",
  clean: true,
  dts: {
    resolve: true,
  },
  splitting: false,
  format: ["esm"],
  bundle: env === "production",
  watch: env === "development",
  outDir: env === "production" ? "dist" : "lib",
  entry: listEntryFiles("src"),
});

// - automate the entry listing
function listEntryFiles(dirPath: string): { [key: string]: string } {
  // Initialize an empty object to store the file paths
  const files: { [key: string]: string } = {};

  // Read the contents of the directory
  const dirContents = fs.readdirSync(dirPath, { withFileTypes: true });

  // Loop through each item in the directory
  for (let dirEntry of dirContents) {
    // Construct the full path of the item
    const fullPath = path.join(dirPath, dirEntry.name);

    // Check if the item is a file
    if (dirEntry.isFile() && /\.(ts|tsx)$/.test(dirEntry.name)) {
      // Remove the file extension from the name
      const fileName = path.parse(dirEntry.name).name;
      // Add the file to the object with its name (without extension) as the key and full path as the value
      files[fileName] = fullPath;
    } else if (dirEntry.isDirectory() && hasTsIndex(fullPath)) {
      try {
        let indexTsPath = path.join(
          fullPath,
          fs.existsSync(path.join(fullPath, "index.ts"))
            ? "index.ts"
            : "index.tsx"
        );

        files[dirEntry.name] = indexTsPath;
      } catch {}
    }
  }

  return files;
}

function hasTsIndex(dirPath: string) {
  const indexTSPath = path.join(dirPath, "index.ts");
  const indexTSXPath = path.join(dirPath, "index.tsx");

  return fs.existsSync(indexTSPath) || fs.existsSync(indexTSXPath);
}

console.log(listEntryFiles("src"));
