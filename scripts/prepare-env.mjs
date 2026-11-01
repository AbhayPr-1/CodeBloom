#!/usr/bin/env node

import { constants, copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envExample = resolve(root, ".env.example");
const envLocal = resolve(root, ".env.local");

if (!existsSync(envExample)) {
  console.error("CodeBloom setup: .env.example is missing; could not initialize local environment.");
  process.exit(1);
}

try {
  copyFileSync(envExample, envLocal, constants.COPYFILE_EXCL);
  console.log("Created .env.local from .env.example.");
} catch (error) {
  if (error?.code === "EEXIST") {
    console.log("Kept the existing .env.local unchanged.");
  } else {
    console.error(`CodeBloom setup: .env.local could not be initialized: ${error.message}`);
    process.exit(1);
  }
}
