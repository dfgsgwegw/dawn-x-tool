import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, mkdir } from "fs/promises";

async function buildAll() {
  await rm("dist", { recursive: true, force: true });
  await rm("api", { recursive: true, force: true });
  await mkdir("api", { recursive: true });

  console.log("Building frontend with Vite...");
  await viteBuild();

  console.log("Bundling API for Vercel...");
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
