import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const publicDir = join(process.cwd(), ".output", "public");
const assetsDir = join(publicDir, "assets");
const forbiddenName = /(pglite|initdb)/i;
const forbiddenSource = /@electric-sql\/pglite|electric-sql__pglite/i;

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

async function main() {
  try {
    await stat(assetsDir);
  } catch {
    throw new Error(
      "Client bundle invariant cannot run because .output/public/assets is missing. Run the Vite build/typecheck before this gate.",
    );
  }

  const files = await walk(assetsDir);
  const violations = [];
  let totalBytes = 0;
  const sized = [];

  for (const file of files) {
    const info = await stat(file);
    totalBytes += info.size;
    sized.push({ file, bytes: info.size });

    const rel = relative(publicDir, file).replaceAll("\\", "/");
    if (forbiddenName.test(rel)) {
      violations.push(`${rel}: database/PGLite artifact name leaked into the public bundle`);
      continue;
    }

    const extension = extname(file).toLowerCase();
    if (extension === ".js" || extension === ".mjs") {
      const source = await readFile(file, "utf8");
      if (forbiddenSource.test(source)) {
        violations.push(`${rel}: database/PGLite package reference leaked into a public JavaScript chunk`);
      }
    }
  }

  sized.sort((a, b) => b.bytes - a.bytes);
  const largest = sized
    .slice(0, 5)
    .map(({ file, bytes }) => `${relative(publicDir, file).replaceAll("\\", "/")}=${(bytes / 1024).toFixed(1)} KiB`)
    .join("; ");

  console.log(
    `[client-bundle] ${files.length} public assets, ${(totalBytes / 1024 / 1024).toFixed(2)} MiB raw. Largest: ${largest || "none"}`,
  );

  if (violations.length) {
    throw new Error(
      `Client bundle invariant failed. Server database payload must never ship to browsers:\n- ${violations.join("\n- ")}`,
    );
  }

  console.log("[client-bundle] PASS: no PGLite/database runtime artifacts in the browser bundle.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
