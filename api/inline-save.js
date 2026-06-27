// Vercel serverless function (ESM -- this project is "type":"module"): persist
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
  // never let a request reach outside src/pages/*.astro (no `..` traversal, no
  // odd characters in the GitHub Contents path)
  if (p.includes("..") || !/^[A-Za-z0-9][A-Za-z0-9/_-]*$/.test(p)) return [];
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

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// inline only ever edits leaf-text elements, but it sends the DOM's textContent
// as `old`, which rarely equals the .astro source byte-for-byte: Astro trims the
// first line's indentation (and reflows the rest), and the browser decodes HTML
// entities (&amp; -> &). So we match tolerantly. We also escape `& < > { }` in
// the new text so the committed source stays valid markup -- `{ }` matter because
// Astro treats them as JSX expressions and would break the build.
export function encodeForSource(s) {
  return String(s)
    .replace(/&(?!#\d+;|#x[0-9a-fA-F]+;|[a-zA-Z][a-zA-Z0-9]*;)/g, "&amp;") // bare & only
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\{/g, "&#123;")
    .replace(/\}/g, "&#125;");
}

// end of the leading `---\n...\n---\n` frontmatter fence (0 if there is none)
function frontmatterEnd(content) {
  const m = /^---\r?\n[\s\S]*?\r?\n---\r?\n/.exec(content);
  return m ? m[0].length : 0;
}

// is [start,end) genuine element text content -- after the frontmatter, not
// inside a `<...>` tag/attribute, and not straddling markup? This is what keeps
// a short edit (e.g. "about") from clobbering the same string in a `title="..."`
// attribute or in the frontmatter instead of the visible element.
function isTextSpan(content, start, end, bodyStart) {
  if (start < bodyStart) return false;
  for (let i = start; i < end; i++) {
    const ch = content[i];
    if (ch === "<" || ch === ">") return false; // span crossed into markup
  }
  const lastOpen = content.lastIndexOf("<", start - 1);
  const lastClose = content.lastIndexOf(">", start - 1);
  return lastClose >= lastOpen; // nearest delimiter before us is `>` => in text
}

// Locate `oldText` in `content` -- exact first, then whitespace/entity tolerant --
// but ONLY accept a hit that lies in element text content, and replace just that
// hit with `newText`. Returns the new content string, or null if not found there.
export function replaceTolerant(content, oldText, newText) {
  const repl = encodeForSource(newText);
  const bodyStart = frontmatterEnd(content);

  // 1) exact substring (covers all single-line text), skipping tag/frontmatter hits
  let from = 0, idx;
  while ((idx = content.indexOf(oldText, from)) !== -1) {
    if (isTextSpan(content, idx, idx + oldText.length, bodyStart)) {
      return content.slice(0, idx) + repl + content.slice(idx + oldText.length);
    }
    from = idx + 1;
  }

  // 2) tolerant: any whitespace run matches any run, and a literal & / < / > also
  //    matches its entity form. Cap length: very long patterns can throw at the
  //    regex engine's lazy-compile step (inside exec), so bound and guard it.
  const trimmed = oldText.trim();
  if (!trimmed || trimmed.length > 4000) return null;
  let pat = escapeRe(trimmed).replace(/\s+/g, "\\s+");
  pat = pat
    .replace(/&/g, "(?:&amp;|&)")
    .replace(/</g, "(?:&lt;|<)")
    .replace(/>/g, "(?:&gt;|>)");
  try {
    const re = new RegExp(pat, "g");
    let m;
    while ((m = re.exec(content)) !== null) {
      const s = m.index, e = s + m[0].length;
      if (isTextSpan(content, s, e, bodyStart)) {
        return content.slice(0, s) + repl + content.slice(e);
      }
      if (re.lastIndex === s) re.lastIndex++; // never spin on a zero-width match
    }
  } catch {
    return null;
  }
  return null;
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
  const committed = []; // keys the client may safely treat as saved
  const misses = []; // keys (or text snippets) that did not match -- keep them editable
  for (const e of valid) {
    const next = replaceTolerant(content, e.old, e.new);
    const tag = e.key != null ? e.key : String(e.old).trim().slice(0, 60);
    if (next != null) {
      content = next;
      replaced++;
      committed.push(tag);
    } else misses.push(tag);
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
  return res.status(200).json({ ok: true, file, replaced, committed, misses });
}
