const { spawnSync } = require("node:child_process");
const path = require("node:path");

function backendProcesses(processes, backendDir, nestCliPath) {
  const normalize = value => path.win32.normalize(value).toLowerCase();
  const entryPoints = new Set([path.win32.join(backendDir, "dist", "main"), path.win32.join(backendDir, "dist", "main.js")].map(normalize));
  return processes.filter(process => {
    const args = Array.from((process.CommandLine || "").matchAll(/"([^"]*)"|(\S+)/g), match => match[1] ?? match[2]);
    const paths = args.map(normalize);
    return paths.some(arg => entryPoints.has(arg)) ||
      (paths.includes(normalize(nestCliPath)) && args.includes("start"));
  });
}

function listProcesses() {
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
    "$ErrorActionPreference = 'Stop'; @(Get-CimInstance Win32_Process -Filter \"name = 'node.exe'\" | Select-Object ProcessId,ParentProcessId,CommandLine) | ConvertTo-Json -Compress"],
    { encoding: "utf8", windowsHide: true });
  if (result.error || result.status !== 0) {
    throw new Error(`Cannot inspect running Node processes. ${result.error?.message || result.stderr.trim()}`);
  }
  const parsed = JSON.parse(result.stdout.trim() || "[]");
  return Array.isArray(parsed) ? parsed : [parsed];
}

function main() {
  const backendDir = path.resolve(__dirname, "..");
  const stopBackend = process.argv.includes("--stop-backend");
  const args = process.argv.slice(2).filter(arg => arg !== "--stop-backend");
  if (process.platform === "win32") {
    const nestCli = require.resolve("@nestjs/cli/bin/nest.js");
    let matches = backendProcesses(listProcesses(), backendDir, nestCli);
    if (matches.length && !stopBackend) {
      console.error(`Prisma cannot replace its Windows engine while this backend is running (PIDs: ${matches.map(p => p.ProcessId).join(", ")}).`);
      console.error("Stop the backend AND its Nest watcher, or run: npm run prisma:generate:safe");
      console.error("The safe command stops only this project's backend, generates Prisma, and leaves it stopped.");
      return 1;
    }
    // Stop launchers first; /T stops their child tree so a watcher cannot respawn it.
    const normalizedCli = path.win32.normalize(nestCli).toLowerCase();
    const isLauncher = p => path.win32.normalize(p.CommandLine || "").toLowerCase().includes(normalizedCli);
    matches.sort((a,b) => Number(isLauncher(b)) - Number(isLauncher(a)));
    for (const candidate of matches) {
      // Recheck the PID and executable path immediately before terminating it.
      const current = backendProcesses(listProcesses(), backendDir, nestCli).find(p => p.ProcessId === candidate.ProcessId);
      if (!current) continue;
      console.log(`Stopping SalesRepApp backend process ${current.ProcessId}...`);
      const stopped = spawnSync("taskkill.exe", ["/PID", String(current.ProcessId), "/T", "/F"], { encoding: "utf8", windowsHide: true });
      if (stopped.error || stopped.status !== 0) {
        // A watcher shutdown may already have removed this process.
        if (backendProcesses(listProcesses(), backendDir, nestCli).some(p => p.ProcessId === current.ProcessId)) {
          throw new Error(`Could not stop process ${current.ProcessId}: ${stopped.error?.message || stopped.stderr.trim()}`);
        }
      }
    }
    if (backendProcesses(listProcesses(), backendDir, nestCli).length) {
      throw new Error("A backend process restarted. Stop its launching terminal and retry.");
    }
  }
  const generated = spawnSync(process.execPath, [require.resolve("prisma/build/index.js"), "generate", ...args], {
    cwd: backendDir, stdio: "inherit", windowsHide: true,
  });
  if (generated.error) throw generated.error;
  if (generated.status === 0 && stopBackend) {
    console.log("Prisma generation complete. Backend remains stopped. Start it with: npm run dev:backend (project root), or npm run dev (backend folder).");
  }
  return generated.status ?? 1;
}
module.exports = { backendProcesses };
if (require.main === module) {
  try { process.exitCode = main(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
