import type { Banquet } from "@/lib/model";

export type LookupExportOptions = {
  title?: string;
  allowPhoneLast4?: boolean;
};

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildLookupHtml(project: Banquet, options: LookupExportOptions = {}) {
  const title = options.title || "来宾座位查询";
  const allowPhoneLast4 = options.allowPhoneLast4 ?? true;

  // Only export minimal fields needed for lookup
  const rows = project.guests.map((g) => {
    const phone = (g.phone || "").trim();
    const phoneLast4 = phone.length >= 4 ? phone.slice(-4) : "";

    const table = g.assignment
      ? project.tables.find((t) => t.id === g.assignment!.tableId)?.name || g.assignment.tableId
      : "";

    return {
      name: g.name,
      phoneLast4,
      table,
      seatNo: g.assignment?.seatNo ?? null,
    };
  });

  const dataJson = JSON.stringify({
    meta: {
      title,
      eventName: project.event.name,
      date: project.event.date || "",
      venue: project.event.venue || "",
      allowPhoneLast4,
      generatedAtUtc: new Date().toISOString(),
    },
    guests: rows,
  });

  // A single-file, dependency-free HTML.
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --bg: #fbf7ea;
      --card: #fffdf6;
      --ink: #2b2b2b;
      --muted: rgba(43,43,43,.6);
      --border: rgba(43,43,43,.18);
      --green: #1f7a5a;
      --gold: #d6b75a;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Noto Sans TC", system-ui, -apple-system, "Segoe UI", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(ellipse at top, rgba(255,255,255,.55) 0%, transparent 55%),
        radial-gradient(ellipse at bottom, rgba(245,234,200,.45) 0%, transparent 55%),
        repeating-linear-gradient(0deg, rgba(0,0,0,.03) 0, rgba(0,0,0,.03) 1px, transparent 1px, transparent 3px),
        var(--bg);
      min-height: 100vh;
      padding: 28px 16px;
    }
    .wrap { max-width: 920px; margin: 0 auto; }
    .brand {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 18px;
    }
    .brand h1 {
      font-family: "Fraunces", serif;
      letter-spacing: -0.02em;
      margin: 0;
      font-size: 32px;
    }
    .brand .meta { font-size: 12px; color: var(--muted); line-height: 1.4; }
    .pill {
      font-size: 12px;
      border: 1px solid var(--border);
      background: rgba(214,183,90,.25);
      padding: 6px 10px;
      border-radius: 999px;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      box-shadow: 0 18px 40px rgba(20, 20, 20, 0.10);
      padding: 18px;
    }
    .search {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
      align-items: center;
      margin-top: 10px;
    }
    input {
      width: 100%;
      border: 1px solid var(--border);
      background: #fff;
      border-radius: 12px;
      padding: 14px 14px;
      font-size: 16px;
      outline: none;
    }
    input:focus { border-color: rgba(31,122,90,.6); box-shadow: 0 0 0 4px rgba(31,122,90,.12); }
    button {
      border: 1px solid rgba(31,122,90,.35);
      background: var(--green);
      color: #fff;
      border-radius: 12px;
      padding: 12px 14px;
      font-size: 14px;
      cursor: pointer;
    }
    button.secondary {
      background: transparent;
      color: var(--green);
      border-color: rgba(31,122,90,.35);
    }
    .hint { margin-top: 10px; font-size: 12px; color: var(--muted); }
    .results { margin-top: 14px; display: grid; gap: 10px; }
    .row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
      align-items: center;
      padding: 12px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: rgba(255,255,255,.6);
    }
    .row .name { font-weight: 700; }
    .seat {
      font-family: "Fraunces", serif;
      font-weight: 800;
      background: rgba(214,183,90,.25);
      border: 1px solid var(--border);
      padding: 8px 10px;
      border-radius: 12px;
      white-space: nowrap;
    }
    .empty {
      padding: 14px;
      border-radius: 12px;
      background: rgba(31,122,90,.06);
      border: 1px dashed rgba(31,122,90,.35);
      color: rgba(31,122,90,.95);
      font-size: 14px;
    }
    footer { margin-top: 14px; font-size: 11px; color: var(--muted); line-height: 1.5; }
    @media (max-width: 560px) {
      .search { grid-template-columns: 1fr; }
      button { width: 100%; }
      .row { grid-template-columns: 1fr; }
      .seat { justify-self: start; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="brand">
      <div>
        <h1>${escapeHtml(title)}</h1>
        <div class="meta" id="meta"></div>
      </div>
      <div class="pill">离线可用</div>
    </div>

    <div class="card">
      <div style="font-size:14px; color: var(--muted)">请输入你的姓名${allowPhoneLast4 ? "（或电话后4位）" : ""}：</div>
      <div class="search">
        <input id="q" placeholder="例如：王小明" autocomplete="off" />
        <button id="btn">查询</button>
        <button id="clear" class="secondary" type="button">清除</button>
      </div>
      <div class="hint" id="hint"></div>
      <div class="results" id="results"></div>
      <footer>
        若出现同名：请加上电话后 4 位查询（如果主办方有开放此功能）。
      </footer>
    </div>
  </div>

  <script>
  const DB = ${dataJson};

  function setText(id, text){
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function normalize(s){
    return String(s || "").trim().toLowerCase();
  }

  function render(list){
    const box = document.getElementById('results');
    box.innerHTML = '';

    if (!list.length) {
      const div = document.createElement('div');
      div.className = 'empty';
      div.textContent = '找不到资料。请检查输入，或询问主办方。';
      box.appendChild(div);
      return;
    }

    list.slice(0, 20).forEach(item => {
      const row = document.createElement('div');
      row.className = 'row';

      const left = document.createElement('div');
      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = item.name;
      const small = document.createElement('div');
      small.style.fontSize = '12px';
      small.style.color = 'rgba(43,43,43,.6)';
      small.textContent = item.table && item.seatNo ? '已安排座位' : '尚未安排座位';
      left.appendChild(name);
      left.appendChild(small);

      const seat = document.createElement('div');
      seat.className = 'seat';
      if (item.table && item.seatNo) {
        seat.textContent = String(item.table) + ' · ' + String(item.seatNo) + '号';
      } else {
        seat.textContent = '未分桌';
      }

      row.appendChild(left);
      row.appendChild(seat);
      box.appendChild(row);
    });

    if (list.length > 20) {
      const div = document.createElement('div');
      div.className = 'hint';
      div.textContent = '结果超过 20 笔，只显示前 20。建议再加字缩小范围。';
      box.appendChild(div);
    }
  }

  function levenshtein(a, b) {
    a = String(a || "");
    b = String(b || "");
    const n = a.length, m = b.length;
    if (n === 0) return m;
    if (m === 0) return n;
    const dp = new Array(m + 1);
    for (let j = 0; j <= m; j++) dp[j] = j;
    for (let i = 1; i <= n; i++) {
      let prev = dp[0];
      dp[0] = i;
      for (let j = 1; j <= m; j++) {
        const tmp = dp[j];
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[j] = Math.min(
          dp[j] + 1,
          dp[j - 1] + 1,
          prev + cost
        );
        prev = tmp;
      }
    }
    return dp[m];
  }

  function scoreMatch(name, q) {
    // lower score = better
    if (!q) return 999;
    if (name === q) return 0;
    if (name.startsWith(q)) return 1;
    if (name.includes(q)) return 2;

    // Typo-tolerant (for short inputs)
    const L = Math.max(name.length, q.length);
    if (L <= 6) {
      const d = levenshtein(name, q);
      if (d <= 1) return 3;
      if (d === 2) return 4;
    }

    return 999;
  }

  function search(){
    const qRaw = document.getElementById('q').value;
    const q = normalize(qRaw).replace(/\s+/g, '');
    if (!q) {
      setText('hint', '请输入姓名进行查询。');
      document.getElementById('results').innerHTML = '';
      return;
    }

    const allowPhoneLast4 = !!DB.meta.allowPhoneLast4;

    const ranked = [];
    for (const g of DB.guests) {
      const name = normalize(g.name).replace(/\s+/g, '');

      // Strong match: phone last4
      if (allowPhoneLast4 && q.length === 4 && normalize(g.phoneLast4) === q) {
        ranked.push({ g, score: -1 });
        continue;
      }

      const s = scoreMatch(name, q);
      if (s < 999) ranked.push({ g, score: s });
    }

    ranked.sort((a, b) => a.score - b.score || String(a.g.name).localeCompare(String(b.g.name), 'zh-Hans'));
    const list = ranked.map(x => x.g);

    setText('hint', '找到 ' + String(list.length) + ' 笔结果（模糊匹配）');
    render(list);
  }

  function init(){
    const m = DB.meta;
    const parts = [m.eventName].filter(Boolean);
    if (m.date) parts.push(m.date);
    if (m.venue) parts.push(m.venue);
    setText('meta', parts.join(' · '));
    setText('hint', m.allowPhoneLast4 ? '提示：同名可用电话后 4 位查询。' : '');

    document.getElementById('btn').addEventListener('click', search);
    document.getElementById('q').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') search();
    });
    document.getElementById('clear').addEventListener('click', () => {
      document.getElementById('q').value = '';
      setText('hint', m.allowPhoneLast4 ? '提示：同名可用电话后 4 位查询。' : '');
      document.getElementById('results').innerHTML = '';
      document.getElementById('q').focus();
    });

    // Auto-search from URL param ?q=...
    const params = new URLSearchParams(location.search);
    const preset = params.get('q');
    if (preset) {
      document.getElementById('q').value = preset;
      search();
    }
  }

  init();
  </script>
</body>
</html>`;
}
