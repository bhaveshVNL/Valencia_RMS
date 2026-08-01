const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const sourceRoot = path.resolve(__dirname, "..");

const getJavaScriptFiles = (directory) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) return getJavaScriptFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".js") ? [entryPath] : [];
  });

const files = getJavaScriptFiles(sourceRoot);

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    stdio: "inherit",
  });

  if (result.status !== 0) process.exit(result.status || 1);
}

console.log(`Syntax check passed for ${files.length} backend files.`);
