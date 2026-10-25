import { spawnSync } from "node:child_process";
const command = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(command, ["run", process.argv[2] || "build"], {
  stdio: "inherit",
  env: { ...process.env, STORY_FILE: "stories/sponsor/story.json" },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
