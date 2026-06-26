// Vercel serverless function (ESM — this project is "type":"module"): persist
// inline's edits by committing them to the GitHub source, so "save" permanently
// changes the live site (commit -> redeploy).
//
// Auth: the edit code (its sha256 must match EDIT_HASH) is passed as ?code=...
// and verified here, so only the code-holder can commit. The GitHub token lives
// server-side only (Vercel env var GITHUB_TOKEN).
//
// Required env: GITHUB_TOKEN (fine-grained PAT, Contents: read & write on the repo)
// Optional env: GITHUB_REPO (default theelinumbriel/elisatoworld), GITHUB_BRANCH (default main)

import crypto from "node:crypto";

const EDIT_HASH = "5e26c0d535c1a10b88652b8ad91c4b36b9ece411f7ef92e9dba9247cff089af0";
const REPO = process.env.GITHUB_REPO || "theelinumbriel/elisatoworld";
const BRANCH = process.env.GITHUB_BRANCH || "main";

const sha256 = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");

function candidates(rawPath) {
  let p = String(rawPath || "/").split("?")[0].split("#")[0];
  p = p.replace(/\/+$/, "").replace(/\/edit$/, "").replace(/^\/+/, "");
  if (!p) return ["src/pages/index.astro"];
  return [`src/pages/${p}.astro`, `src/pages/${p}/index.astro`];
}

async function gh(path, init) {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "inline-save",
      ...(init && init.headers),
    },
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });
  if (!process.env.GITHUB_TOKEN)
    return res.status(500).json({ ok: false, error: "server missing GITHUB_TOKEN env var" });

  const code = (req.query && req.query.code) || "";
  if (sha256(code) !== EDIT_HASH) return res.status(401).json({ ok: false, error: "bad code" });

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  const edits = (body && body.edits) || [];
  const valid = edits.filter((e) => e && e.old != null && e.new != null && e.old !== e.new);
  if (!valid.length) return res.status(400).json({ ok: false, error: "no edits" });

  let file = null,
    sha = null,
    content = null;
  for (const cand of candidates(body && body.path)) {
    const r = await gh(`/repos/${REPO}/contents/${cand}?ref=${BRANCH}`);
    if (r.ok) {
      const j = await r.json();
      file = cand;
      sha = j.sha;
      content = Buffer.from(j.content, "base64").toString("utf8");
      break;
    }
  }
  if (!file)
    return res.status(404).json({ ok: false, error: "no source file for " + (body && body.path) });

  let replaced = 0;
  const misses = [];
  for (const e of valid) {
    if (content.includes(e.old)) {
      content = content.split(e.old).join(e.new);
      replaced++;
    } else misses.push(String(e.old).slice(0, 60));
  }
  if (!replaced)
    return res.status(422).json({ ok: false, error: "none of the edits were found in source", misses, file });

  const put = await gh(`/repos/${REPO}/contents/${file}`, {
    method: "PUT",
    body: JSON.stringify({
      message: `inline: edit ${file} (${replaced} change${replaced > 1 ? "s" : ""})`,
      content: Buffer.from(content, "utf8").toString("base64"),
      sha,
      branch: BRANCH,
    }),
  });
  if (!put.ok) {
    const t = await put.text();
    return res.status(502).json({ ok: false, error: "github commit failed", detail: t.slice(0, 300) });
  }
  return res.status(200).json({ ok: true, file, replaced, misses });
}
