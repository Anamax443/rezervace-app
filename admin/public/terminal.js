// terminal.js — Collapsible terminal panel for superadmin console
// Usage:
//   <div id="terminal-container"></div>
//   <script src="/terminal.js" is:inline></script>
//   window.term.ok("Supabase DB — 1 tenant");

(function() {
  "use strict";

  var container = document.getElementById("terminal-container");
  if (!container) return;

  var t = (typeof window.t === "function") ? window.t : function(k) { return k; };

  // === STYLE ===
  var style = document.createElement("style");
  style.textContent = [
    ".term-wrapper {",
    "  background: #1a1b26;",
    "  border: 1px solid #3b3d52;",
    "  border-radius: 8px;",
    "  font-family: 'Cascadia Code','Fira Code','JetBrains Mono','Consolas',monospace;",
    "  font-size: 12px;",
    "  overflow: hidden;",
    "  margin-top: 1.5rem;",
    "}",
    ".term-header {",
    "  background: #24283b;",
    "  padding: 6px 12px;",
    "  display: flex;",
    "  align-items: center;",
    "  justify-content: space-between;",
    "  border-bottom: 1px solid #3b3d52;",
    "  user-select: none;",
    "  cursor: pointer;",
    "}",
    ".term-header:hover { background: #2a2e42; }",
    ".term-title {",
    "  color: #7aa2f7;",
    "  font-weight: 600;",
    "  font-size: 11px;",
    "  letter-spacing: 0.5px;",
    "  display: flex;",
    "  align-items: center;",
    "  gap: 6px;",
    "}",
    ".term-title .arrow {",
    "  transition: transform 0.2s;",
    "  display: inline-block;",
    "}",
    ".term-title .arrow.open { transform: rotate(90deg); }",
    ".term-dots { display:flex; gap:5px; }",
    ".term-dot { width:8px; height:8px; border-radius:50%; }",
    ".term-dot-r { background:#f7768e; }",
    ".term-dot-y { background:#e0af68; }",
    ".term-dot-g { background:#9ece6a; }",
    ".term-badge {",
    "  font-size: 10px;",
    "  padding: 1px 6px;",
    "  border-radius: 8px;",
    "  display: none;",
    "}",
    ".term-badge.has-errors {",
    "  display: inline;",
    "  background: #f7768e33;",
    "  color: #f7768e;",
    "}",
    ".term-badge.all-ok {",
    "  display: inline;",
    "  background: #9ece6a33;",
    "  color: #9ece6a;",
    "}",
    ".term-controls { display:flex; gap:4px; }",
    ".term-btn {",
    "  background: #3b3d52;",
    "  color: #a9b1d6;",
    "  border: none;",
    "  padding: 2px 8px;",
    "  border-radius: 3px;",
    "  font-size: 10px;",
    "  cursor: pointer;",
    "  font-family: inherit;",
    "  transition: background 0.15s;",
    "}",
    ".term-btn:hover { background:#545775; }",
    ".term-collapsible {",
    "  max-height: 0;",
    "  overflow: hidden;",
    "  transition: max-height 0.25s ease;",
    "}",
    ".term-collapsible.open {",
    "  max-height: 600px;",
    "}",
    ".term-body {",
    "  padding: 8px 12px;",
    "  max-height: 220px;",
    "  min-height: 60px;",
    "  overflow-y: auto;",
    "  color: #a9b1d6;",
    "  line-height: 1.6;",
    "}",
    ".term-body::-webkit-scrollbar { width:5px; }",
    ".term-body::-webkit-scrollbar-track { background:#1a1b26; }",
    ".term-body::-webkit-scrollbar-thumb { background:#3b3d52; border-radius:3px; }",
    ".term-line { white-space:pre-wrap; word-break:break-all; }",
    ".term-line .ts { color:#565f89; font-size:11px; }",
    ".term-line.ok .msg { color:#9ece6a; }",
    ".term-line.error .msg { color:#f7768e; }",
    ".term-line.warn .msg { color:#e0af68; }",
    ".term-line.info .msg { color:#7aa2f7; }",
    ".term-line.dim .msg { color:#565f89; }",
    ".term-line .label { font-weight:700; margin-right:4px; }",
    ".term-line.ok .label { color:#9ece6a; }",
    ".term-line.error .label { color:#f7768e; }",
    ".term-line.warn .label { color:#e0af68; }",
    ".term-line.info .label { color:#7aa2f7; }",
    ".term-cursor {",
    "  display:inline-block; width:6px; height:12px;",
    "  background:#7aa2f7; animation:term-blink 1s step-end infinite;",
    "  vertical-align:text-bottom; margin-left:2px;",
    "}",
    "@keyframes term-blink { 50% { opacity:0; } }",
    ".term-separator { border:none; border-top:1px solid #3b3d52; margin:4px 0; }",
    ".term-status-bar {",
    "  background: #24283b;",
    "  padding: 3px 12px;",
    "  display: flex;",
    "  justify-content: space-between;",
    "  border-top: 1px solid #3b3d52;",
    "  font-size: 10px;",
    "  color: #565f89;",
    "}"
  ].join("\n");
  document.head.appendChild(style);

  // === HTML ===
  container.innerHTML =
    '<div class="term-wrapper">' +
      '<div class="term-header" id="term-header">' +
        '<div style="display:flex;align-items:center;gap:10px;">' +
          '<div class="term-dots">' +
            '<span class="term-dot term-dot-r"></span>' +
            '<span class="term-dot term-dot-y"></span>' +
            '<span class="term-dot term-dot-g"></span>' +
          '</div>' +
          '<span class="term-title"><span class="arrow" id="term-arrow">\u25B6</span> Terminal</span>' +
          '<span class="term-badge" id="term-badge"></span>' +
        '</div>' +
        '<div class="term-controls">' +
          '<button class="term-btn" id="term-clear-btn">' + t("termClear") + '</button>' +
          '<button class="term-btn" id="term-copy-btn">' + t("termCopy") + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="term-collapsible" id="term-collapsible">' +
        '<div class="term-body" id="term-body">' +
          '<div class="term-line dim"><span class="msg">' + t("termReady") + '</span><span class="term-cursor"></span></div>' +
        '</div>' +
        '<div class="term-status-bar">' +
          '<span id="term-line-count">0 lines</span>' +
          '<span id="term-last-update"></span>' +
        '</div>' +
      '</div>' +
    '</div>';

  var body = document.getElementById("term-body");
  var collapsible = document.getElementById("term-collapsible");
  var arrowEl = document.getElementById("term-arrow");
  var badgeEl = document.getElementById("term-badge");
  var lineCountEl = document.getElementById("term-line-count");
  var lastUpdateEl = document.getElementById("term-last-update");
  var lineCount = 0;
  var errorCount = 0;
  var okCount = 0;
  var isOpen = false;

  // === TOGGLE ===
  function toggle() {
    isOpen = !isOpen;
    collapsible.classList.toggle("open", isOpen);
    arrowEl.classList.toggle("open", isOpen);
    if (isOpen) body.scrollTop = body.scrollHeight;
  }

  function autoOpen() {
    if (!isOpen) toggle();
  }

  document.getElementById("term-header").addEventListener("click", function(e) {
    if (e.target.closest(".term-btn")) return;
    toggle();
  });

  // === HELPERS ===
  function timestamp() {
    var d = new Date();
    return String(d.getHours()).padStart(2,"0") + ":" +
           String(d.getMinutes()).padStart(2,"0") + ":" +
           String(d.getSeconds()).padStart(2,"0") + "." +
           String(d.getMilliseconds()).padStart(3,"0");
  }

  function removeCursor() {
    var c = body.querySelectorAll(".term-cursor");
    for (var i = 0; i < c.length; i++) c[i].remove();
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  function updateStatus() {
    lineCount++;
    lineCountEl.textContent = lineCount + " lines";
    lastUpdateEl.textContent = timestamp();
  }

  function updateBadge() {
    if (errorCount > 0) {
      badgeEl.textContent = errorCount + " error" + (errorCount > 1 ? "s" : "");
      badgeEl.className = "term-badge has-errors";
    } else if (okCount > 0) {
      badgeEl.textContent = okCount + " OK";
      badgeEl.className = "term-badge all-ok";
    }
  }

  function addLine(type, label, text) {
    removeCursor();
    var line = document.createElement("div");
    line.className = "term-line " + type;
    line.innerHTML =
      '<span class="ts">[' + timestamp() + '] </span>' +
      (label ? '<span class="label">[' + label + ']</span> ' : '') +
      '<span class="msg">' + escapeHtml(text) + '</span>';
    body.appendChild(line);
    var cur = document.createElement("span");
    cur.className = "term-cursor";
    line.appendChild(cur);
    body.scrollTop = body.scrollHeight;
    updateStatus();
  }

  function getPlainText() {
    var lines = body.querySelectorAll(".term-line");
    var out = [];
    for (var i = 0; i < lines.length; i++) out.push(lines[i].textContent);
    return out.join("\n");
  }

  // === EVENTS ===
  document.getElementById("term-clear-btn").addEventListener("click", function(e) {
    e.stopPropagation();
    body.innerHTML = "";
    lineCount = 0; errorCount = 0; okCount = 0;
    lineCountEl.textContent = "0 lines";
    lastUpdateEl.textContent = "";
    badgeEl.className = "term-badge";
    badgeEl.textContent = "";
    addLine("dim", "", t("termCleared"));
  });

  document.getElementById("term-copy-btn").addEventListener("click", function(e) {
    e.stopPropagation();
    navigator.clipboard.writeText(getPlainText()).then(function() {
      addLine("info", "INFO", t("termCopied"));
    });
  });

  // === PUBLIC API ===
  window.term = {
    log: function(text)   { autoOpen(); addLine("info","",text); },
    ok: function(text)    { autoOpen(); okCount++; updateBadge(); addLine("ok","OK",text); },
    error: function(text) { autoOpen(); errorCount++; updateBadge(); addLine("error","CHYBA",text); },
    warn: function(text)  { autoOpen(); addLine("warn","WARN",text); },
    info: function(text)  { autoOpen(); addLine("info","INFO",text); },
    dim: function(text)   { addLine("dim","",text); },

    separator: function() {
      removeCursor();
      var hr = document.createElement("hr");
      hr.className = "term-separator";
      body.appendChild(hr);
    },

    banner: function(text) {
      autoOpen();
      removeCursor();
      var line = document.createElement("div");
      line.className = "term-line info";
      line.innerHTML =
        '<span class="ts">[' + timestamp() + '] </span>' +
        '<span class="msg" style="font-weight:700;">\u2550\u2550\u2550 ' +
        escapeHtml(text) + ' \u2550\u2550\u2550</span>';
      body.appendChild(line);
      body.scrollTop = body.scrollHeight;
      updateStatus();
    },

    clear: function() {
      body.innerHTML = "";
      lineCount = 0; errorCount = 0; okCount = 0;
      lineCountEl.textContent = "0 lines";
      lastUpdateEl.textContent = "";
      badgeEl.className = "term-badge";
      badgeEl.textContent = "";
    },

    open: function() { if (!isOpen) toggle(); },
    close: function() { if (isOpen) toggle(); },
    toggle: toggle,

    resetCounters: function() {
      errorCount = 0; okCount = 0;
      badgeEl.className = "term-badge";
      badgeEl.textContent = "";
    },

    testService: async function(name, testFn) {
      addLine("dim", "", "Testing " + name + "...");
      try {
        var result = await testFn();
        okCount++; updateBadge();
        addLine("ok", "OK", name + " \u2014 " + result);
        return { service: name, status: "ok", detail: result };
      } catch (e) {
        var msg = e.message || String(e);
        errorCount++; updateBadge();
        addLine("error", "CHYBA", name + " \u2014 " + msg);
        return { service: name, status: "error", detail: msg };
      }
    }
  };

})();
