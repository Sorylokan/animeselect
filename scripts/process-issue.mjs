// Entry point of the "suggestion" workflow: issue → data/avis/<id>.json.
// In GitHub Actions: reads GITHUB_EVENT_PATH, writes status to GITHUB_OUTPUT.
// Locally (dry run, writes nothing): node scripts/process-issue.mjs <issue-body.md> [author]

import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { processSubmission, invalidComment, pullRequestBody } from "./submission.mjs";
import { fetchMedia } from "./anilist.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const avisDir = resolve(root, "data/avis");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const avisPath = (id) => resolve(avisDir, `${id}.json`);

const inActions = Boolean(process.env.GITHUB_EVENT_PATH);
let issue;
if (inActions) {
  issue = readJson(process.env.GITHUB_EVENT_PATH).issue;
} else if (process.argv[2]) {
  const now = new Date().toISOString();
  issue = { body: readFileSync(process.argv[2], "utf8"), user: { login: process.argv[3] ?? "local-test" }, number: 0, updated_at: now };
} else {
  console.error("Usage: node scripts/process-issue.mjs <issue-body.md> [author]");
  process.exit(2);
}

const taxonomy = readJson(resolve(root, "data/taxonomy.json"));
const result = await processSubmission({
  body: issue.body ?? "",
  author: issue.user.login,
  issueNumber: issue.number,
  submittedAt: issue.updated_at ?? issue.created_at,
  moodIds: new Set(taxonomy.moodTags.map((m) => m.id)),
  loadReviews: (id) => (existsSync(avisPath(id)) ? readJson(avisPath(id)) : []),
  fetchMedia: (ids) => fetchMedia(ids),
});

if (!inActions) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

const out = process.env.RUNNER_TEMP ?? tmpdir();
if (result.status === "invalid") {
  writeFileSync(resolve(out, "comment.md"), invalidComment(result.errors));
}
if (result.status === "ok") {
  mkdirSync(avisDir, { recursive: true });
  for (const f of result.files) writeFileSync(avisPath(f.anilist_id), JSON.stringify(f.reviews, null, 2) + "\n");
  writeFileSync(resolve(out, "pr.md"), pullRequestBody({ author: issue.user.login, issueNumber: issue.number, summary: result.summary }));
}
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `status=${result.status}\n`);
console.log(`Issue #${issue.number}: ${result.status}`);
