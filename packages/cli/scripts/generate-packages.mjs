import * as fs from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CLI_ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const PACKAGES_ROOT = resolve(CLI_ROOT, "..");
const REPO_ROOT = resolve(PACKAGES_ROOT, "..");
const MANIFEST_PATH = resolve(CLI_ROOT, "package.json");

const rootManifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));

function copyBinaryToNativePackage(platform, arch) {
  const os = platform;
  const buildName = `cli-${platform}-${arch}`;
  const packageRoot = resolve(CLI_ROOT, "npm", buildName);
  const packageName = `@tscanner/${buildName}`;

  const { version, license, repository } = rootManifest;

  const binaryName = os === "win32" ? "tscanner.exe" : "tscanner";

  const manifest = JSON.stringify(
    {
      name: packageName,
      version,
      license,
      repository: repository.url,
      main: binaryName,
      os: [os],
      cpu: [arch],
      files: [binaryName]
    },
    null,
    2
  );

  if (!fs.existsSync(packageRoot)) {
    console.info(`Create directory ${packageRoot}`);
    fs.mkdirSync(packageRoot, { recursive: true });
  }

  const manifestPath = resolve(packageRoot, "package.json");
  console.info(`Update manifest ${manifestPath}`);
  fs.writeFileSync(manifestPath, manifest);

  const ext = os === "win32" ? ".exe" : "";
  const binaryPath = resolve(packageRoot, `tscanner${ext}`);

  if (fs.existsSync(binaryPath)) {
    console.info(`Binary already exists at ${binaryPath}`);
    fs.chmodSync(binaryPath, 0o755);
  } else {
    console.warn(`Binary not found at ${binaryPath} - ensure workflow copied it`);
  }
}

function updateVersionInDependencies(dependencies, version) {
  if (dependencies) {
    for (const dependency of Object.keys(dependencies)) {
      if (dependency.startsWith("@tscanner/")) {
        dependencies[dependency] = version;
      }
    }
  }
}

function updateCliPackageVersion() {
  const manifestPath = MANIFEST_PATH;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

  const { version } = manifest;

  updateVersionInDependencies(manifest.optionalDependencies, version);

  console.info(`Update manifest ${manifestPath}`);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
}

const PLATFORMS = [
  { platform: "win32", arch: "x64" },
  { platform: "darwin", arch: "x64" },
  { platform: "darwin", arch: "arm64" },
  { platform: "linux", arch: "x64" },
  { platform: "linux", arch: "arm64" }
];

for (const { platform, arch } of PLATFORMS) {
  copyBinaryToNativePackage(platform, arch);
}

updateCliPackageVersion();

console.info("✅ All packages generated successfully");
