/*!
 * inline -- edit the text on any page, in place. zero dependencies, one file.
 *
 * drop it in:
 *   <script src="inline.js"></script>
 * then add ?edit (or #edit) to the url, or press ⌘/Ctrl+Shift+E.
 * click any text, type, and your edits are saved to this browser. hit
 * "copy changes" to get a JSON map you can paste back into your source.
 *
 * options via the script tag's data-* attributes:
 *   data-selector="h1,h2,p,li,…"   which elements are editable (default below)
 *   data-auto="1"                   force edit mode on (ignore ?edit gate)
 */
(function () {
  "use strict";

  const script = document.currentScript;
  const cfg = (script && script.dataset) || {};

  // editable element types. we only ever touch *leaf* text (an element with no
  // child elements), so structure and markup are never mangled -- "just the text".
  const SELECTOR =
    cfg.selector ||
    "h1,h2,h3,h4,h5,h6,p,li,blockquote,figcaption,a,span,small,em,strong,td,th,dd,dt,label,button";

  const STORE_KEY = "inline:" + location.pathname;
  const PLAINTEXT = isPlaintextOnlySupported();
  let editing = false;
  let bar = null;

  // ---- persistence -------------------------------------------------------
  const load = () => {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    } catch {
      return {};
    }
  };
  const save = (obj) => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(obj));
    } catch {}
  };
  let store = load();
  // the server-rendered text of each editable element, captured BEFORE any local
  // override is painted on. this is what we send as `old`, so the server always
  // matches against what is really in the source -- never a stale local override
  // (which would make the server reject the save: "none of the edits were found").
  let pristine = {};

  // ---- element selection -------------------------------------------------
  function isLeafText(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.closest("#inline-bar")) return false;
    if (el.hasAttribute("data-inline-skip")) return false;
    // only elements whose children are all text nodes (a true text leaf)
    for (const n of el.childNodes) if (n.nodeType === 1) return false;
    return el.textContent.trim().length > 0;
  }

  function editableEls() {
    const out = [];
    document.querySelectorAll(SELECTOR).forEach((el) => {
      if (isLeafText(el)) out.push(el);
    });
    // also honour explicit opt-ins
    document.querySelectorAll("[data-inline]").forEach((el) => {
      if (isLeafText(el) && !out.includes(el)) out.push(el);
    });
    return out;
  }

  // a stable key for an element: id, then data-inline-id, then a structural path
  function keyFor(el) {
    if (el.id) return "#" + el.id;
    if (el.dataset.inlineId) return "k:" + el.dataset.inlineId;
    const path = [];
    let n = el;
    while (n && n.nodeType === 1 && n !== document.body) {
      let sel = n.tagName.toLowerCase();
      const p = n.parentElement;
      if (p) {
        const sibs = Array.prototype.filter.call(p.children, (c) => c.tagName === n.tagName);
        if (sibs.length > 1) sel += ":nth-of-type(" + (sibs.indexOf(n) + 1) + ")";
      }
      path.unshift(sel);
      n = n.parentElement;
    }
    return path.join(">");
  }

  // snapshot the true source text of every editable element, before any override
  // is applied. run once, at boot, ahead of applyOverrides().
  function snapshotPristine() {
    editableEls().forEach((el) => {
      const k = keyFor(el);
      if (!(k in pristine)) pristine[k] = el.textContent;
    });
  }

  // ---- apply saved overrides on every load --------------------------------
  // these bridge the commit -> redeploy gap: a saved edit shows here immediately,
  // and once the redeployed build catches up (its rendered text == the override)
  // the override is redundant and dropped, so it can never go stale.
  function applyOverrides() {
    if (!Object.keys(store).length) return;
    let changed = false;
    editableEls().forEach((el) => {
      const k = keyFor(el);
      if (!(k in store)) return;
      if (k in pristine && pristine[k] === store[k]) {
        delete store[k]; // the live build already has this edit; stop overriding
        changed = true;
        return;
      }
      el.textContent = store[k];
    });
    if (changed) save(store);
  }

  // ---- edit mode ---------------------------------------------------------
  function enable() {
    if (editing) return;
    editing = true;
    injectStyles();
    document.body.classList.add("inline-on");
    editableEls().forEach((el) => {
      const k = keyFor(el);
      el.dataset.inlineOrig = k in pristine ? pristine[k] : el.textContent;
      el.setAttribute("contenteditable", PLAINTEXT ? "plaintext-only" : "true");
      el.classList.add("inline-field");
    });
    document.addEventListener("input", onInput, true);
    showBar();
    updateCount();
  }

  function disable() {
    if (!editing) return;
    editing = false;
    document.body.classList.remove("inline-on");
    document.querySelectorAll(".inline-field").forEach((el) => {
      el.removeAttribute("contenteditable");
      el.classList.remove("inline-field");
    });
    document.removeEventListener("input", onInput, true);
    if (bar) bar.remove();
    bar = null;
  }

  const toggle = () => (editing ? disable() : enable());

  function onInput(e) {
    const el = e.target;
    if (!el.classList || !el.classList.contains("inline-field")) return;
    const k = keyFor(el);
    const now = el.textContent;
    if (now === el.dataset.inlineOrig) delete store[k];
    else store[k] = now;
    save(store);
    updateCount();
  }

  // ---- toolbar -----------------------------------------------------------
  function showBar() {
    bar = document.createElement("div");
    bar.id = "inline-bar";
    bar.innerHTML =
      '<span class="inline-dot"></span>' +
      '<span class="inline-label">inline</span>' +
      '<span class="inline-count" id="inline-count"></span>' +
      '<button type="button" data-act="save" class="inline-primary">save</button>' +
      '<button type="button" data-act="copy">copy changes</button>' +
      '<button type="button" data-act="reset">reset</button>' +
      '<button type="button" data-act="done">done</button>';
    bar.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      const act = b.dataset.act;
      if (act === "save") saveToFile(b);
      else if (act === "copy") copyChanges(b);
      else if (act === "reset") resetAll();
      else if (act === "done") disable();
    });
    document.body.appendChild(bar);
  }

  function updateCount() {
    const c = document.getElementById("inline-count");
    if (!c) return;
    const n = Object.keys(store).length;
    c.textContent = n === 0 ? "no edits yet" : n === 1 ? "1 edit" : n + " edits";
  }

  // permanently write edits back to the source file, via the inline save server
  // (node server.js) or any endpoint you point data-save at.
  async function saveToFile(btn) {
    const edits = [];
    document.querySelectorAll(".inline-field").forEach((el) => {
      const orig = el.dataset.inlineOrig;
      if (orig != null && el.textContent !== orig)
        edits.push({ key: keyFor(el), old: orig, new: el.textContent });
    });
    if (!edits.length) {
      flashBtn(btn, "nothing to save");
      return;
    }
    const endpoint = cfg.save || "/__inline/save";
    btn.textContent = "saving…";
    btn.disabled = true;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: location.pathname, edits }),
      });
      let data = {};
      try {
        data = await res.json();
      } catch {}

      if (!res.ok || !data.ok) {
        // a real response, but the server refused (bad code, missing token, or
        // none of the edits matched the source). surface WHY instead of crying
        // "no save server", and keep every edit so nothing is lost.
        const why = (data && data.error) || "HTTP " + res.status;
        flashBtn(btn, "save failed", 3200);
        const c = document.getElementById("inline-count");
        if (c) c.textContent = "save failed: " + why;
        console.warn("[inline] save failed: " + why, data);
        return;
      }

      // for fields the server actually committed: rebase the baseline and drop the
      // local override (the text now lives in the source). fields it could NOT match
      // keep their override and their pristine baseline, so they retry on the next
      // Save and are never silently dropped.
      const okKeys = data.committed ? new Set(data.committed) : null;
      document.querySelectorAll(".inline-field").forEach((el) => {
        const k = keyFor(el);
        if (!okKeys || okKeys.has(k)) {
          // committed: this IS the new source. rebase the baseline, and keep the
          // override as a bridge so a reload shows it before the redeploy lands;
          // applyOverrides() drops it automatically once the build catches up.
          el.dataset.inlineOrig = el.textContent;
          store[k] = el.textContent;
        }
      });
      save(store);
      updateCount();
      const missed = (data.misses && data.misses.length) || 0;
      if (missed) {
        flashBtn(btn, "saved " + (data.replaced || 0) + "/" + edits.length + " · retry to finish", 3200);
        console.warn("[inline] these edits weren't found in source (kept, will retry):", data.misses);
      } else {
        flashBtn(btn, "saved ✓ · deploying…");
      }
    } catch (err) {
      // fetch itself threw: offline, or no endpoint (e.g. `astro dev` with no
      // serverless runtime). the edits stay in this browser.
      flashBtn(btn, "no save server", 2600);
      console.warn(
        "[inline] couldn't reach the save endpoint. on the deployed site this is " +
          "/api/inline-save; locally, use 'copy changes' to grab the JSON.",
        err
      );
    } finally {
      btn.disabled = false;
    }
  }

  function flashBtn(btn, label, ms) {
    const t = btn.dataset.act === "save" ? "save" : btn.textContent;
    btn.textContent = label;
    setTimeout(() => (btn.textContent = t), ms || 1300);
  }

  function copyChanges(btn) {
    const json = JSON.stringify(store, null, 2);
    const done = () => {
      const t = btn.textContent;
      btn.textContent = "copied ✓";
      setTimeout(() => (btn.textContent = t), 1200);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(json).then(done, () => fallbackCopy(json, done));
    else fallbackCopy(json, done);
  }

  function fallbackCopy(text, done) {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch {}
    ta.remove();
    done && done();
  }

  function resetAll() {
    store = {};
    save(store);
    document.querySelectorAll(".inline-field").forEach((el) => {
      if (el.dataset.inlineOrig != null) el.textContent = el.dataset.inlineOrig;
    });
    updateCount();
  }

  // ---- styles (injected so the whole tool is one file) -------------------
  function injectStyles() {
    if (document.getElementById("inline-style")) return;
    const css = `
      body.inline-on .inline-field{outline:1px dashed rgba(0,0,0,.22);outline-offset:3px;border-radius:2px;cursor:text;transition:outline-color .15s ease}
      body.inline-on .inline-field:hover{outline-color:rgba(0,0,0,.5)}
      body.inline-on .inline-field:focus{outline:2px solid #1aa179;outline-offset:3px;background:rgba(26,160,120,.06)}
      #inline-bar{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:2147483647;display:flex;align-items:center;gap:.65rem;
        padding:.5rem .65rem .5rem .85rem;border-radius:999px;background:rgba(20,20,22,.92);color:#fff;
        font:13px/1 -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;letter-spacing:.01em;
        box-shadow:0 8px 30px rgba(0,0,0,.25);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
      #inline-bar .inline-dot{width:7px;height:7px;border-radius:50%;background:#1ad18a;box-shadow:0 0 0 0 rgba(26,209,138,.6);animation:inlinePulse 2s infinite}
      #inline-bar .inline-label{font-weight:600}
      #inline-bar .inline-count{color:rgba(255,255,255,.55);margin-right:.2rem}
      #inline-bar button{font:inherit;color:#fff;background:rgba(255,255,255,.12);border:0;border-radius:999px;padding:.4rem .7rem;cursor:pointer;transition:background .15s ease}
      #inline-bar button:hover{background:rgba(255,255,255,.22)}
      #inline-bar button.inline-primary{background:#1ad18a;color:#07130d;font-weight:600}
      #inline-bar button.inline-primary:hover{background:#39e0a4}
      #inline-bar button:disabled{opacity:.6;cursor:default}
      @keyframes inlinePulse{0%{box-shadow:0 0 0 0 rgba(26,209,138,.5)}70%{box-shadow:0 0 0 7px rgba(26,209,138,0)}100%{box-shadow:0 0 0 0 rgba(26,209,138,0)}}
      @media (prefers-reduced-motion: reduce){#inline-bar .inline-dot{animation:none}}
    `;
    const s = document.createElement("style");
    s.id = "inline-style";
    s.textContent = css;
    document.head.appendChild(s);
  }

  function isPlaintextOnlySupported() {
    try {
      const d = document.createElement("div");
      d.setAttribute("contenteditable", "plaintext-only");
      return d.contentEditable === "plaintext-only";
    } catch {
      return false;
    }
  }

  // ---- boot --------------------------------------------------------------
  function boot() {
    snapshotPristine();
    applyOverrides();
    const wantEdit =
      cfg.auto === "1" ||
      /(?:^|[?&#])edit(?:=1)?(?:&|$)/.test(location.search) ||
      location.hash.replace("#", "") === "edit";
    if (wantEdit) enable();
  }

  // keyboard toggle: ⌘/Ctrl + Shift + E
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "E" || e.key === "e")) {
      e.preventDefault();
      toggle();
    }
  });

  // expose a tiny API
  window.Inline = { enable, disable, toggle };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
