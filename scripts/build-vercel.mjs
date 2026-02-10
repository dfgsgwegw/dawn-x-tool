import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, mkdir, writeFile } from "fs/promises";
import { execSync } from "child_process";

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("Building frontend with Vite...");
  await viteBuild();

  console.log("Running database migrations...");
  try {
    execSync("npx drizzle-kit push", { stdio: "inherit" });
  } catch (err) {
    console.error("Database migration warning:", err.message);
  }

  console.log("Bundling API for Vercel...");
  await rm("api", { recursive: true, force: true });
  await mkdir("api", { recursive: true });
  await esbuild({
    entryPoints: ["server/vercel.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "api/index.js",
    alias: {
      "@shared": "./shared",
    },
    packages: "external",
    logLevel: "info",
    target: "node18",
  });

  console.log("Vercel build complete!");
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
