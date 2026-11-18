// SkyPost 公开收件箱 v2 (2026-11-18)
// 只读展示 Cloud Mail D1 中某个受支持域名地址收到的邮件（含无人收件）。
// 绑定: D1 变量名 db -> cloud-mail 数据库。无密码，知地址者可看，勿用于重要账号。
const DOMAIN = "skypost.ccwu.cc";
const DOMAINS = ["skypost.ccwu.cc", "liu492.ccwu.cc", "cloudpost.ccwu.cc", "skypost.de5.net"];

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function fmtTime(utcText) {
  if (!utcText) return "";
  const d = new Date(String(utcText).replace(" ", "T") + "Z");
  if (isNaN(d)) return esc(utcText);
  return d.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
}

function htmlToText(html) {
  if (!html) return "";
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function page(title, body) {
  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)}</title>
<style>
body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;margin:0;background:#f5f6f8;color:#222}
.wrap{max-width:760px;margin:0 auto;padding:20px 14px 48px}
h1{font-size:20px;margin:8px 0 4px}
.sub{color:#888;font-size:13px;margin-bottom:16px}
.card{background:#fff;border-radius:12px;padding:14px 16px;margin-bottom:10px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
a.card{display:block;text-decoration:none;color:inherit}
.subj{font-size:16px;font-weight:600;margin-bottom:4px;word-break:break-all}
.meta{color:#888;font-size:13px;word-break:break-all}
.code{display:inline-block;background:#fff7e6;border:1px dashed #f0a020;color:#b96a00;
font-size:22px;font-weight:700;letter-spacing:2px;border-radius:8px;padding:2px 12px;margin-top:8px}
pre{white-space:pre-wrap;word-break:break-word;font-size:14px;line-height:1.65;margin:0}
input[type=text]{width:100%;box-sizing:border-box;padding:12px;border:1px solid #ddd;border-radius:10px;font-size:16px}
button{margin-top:10px;width:100%;padding:12px;border:0;border-radius:10px;background:#1677ff;color:#fff;font-size:16px}
.btn{display:inline-block;margin-top:14px;color:#1677ff;text-decoration:none;font-size:14px}
.empty{color:#999;text-align:center;padding:36px 0}
.warn{background:#fff7e6;color:#8a6100;border-radius:10px;padding:10px 14px;font-size:13px;margin-bottom:16px}
</style></head><body><div class="wrap">${body}</div></body></html>`;
}

function validAddr(a) {
  const m = /^[a-z0-9._%+-]+@([a-z0-9.-]+)$/.exec(a);
  return !!m && DOMAINS.includes(m[1]);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/favicon.ico") return new Response(null, { status: 204 });
    const inbox = (url.searchParams.get("inbox") || "").trim().toLowerCase();
    const headers = { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" };

    if (!inbox) {
      const body = `<h1>SkyPost 公开收件箱</h1>
<div class="sub">输入完整的邮箱地址，查看它收到的邮件（支持 @${DOMAINS.join("、@")}）</div>
<div class="warn">公开页面无密码，知道地址的人都能看。只适合接验证码、注册小号，别收重要邮件。邮件保留 7 天后自动删除。</div>
<form method="get"><input type="text" name="inbox" placeholder="例如 abc@${DOMAIN}" autocomplete="off">
<button type="submit">查看收件箱</button></form>`;
      return new Response(page("SkyPost 公开收件箱", body), { headers });
    }

    if (!validAddr(inbox)) {
      return new Response(page("地址不对", `<h1>地址不对</h1><div class="sub">只支持 @${DOMAINS.join("、@")} 的完整地址</div><a class="btn" href="/">← 返回</a>`), { headers, status: 400 });
    }

    const id = url.searchParams.get("id");
    if (id) {
      const row = await env.db.prepare(
        "SELECT email_id, send_email, name, subject, code, text, content, create_time FROM email WHERE email_id = ? AND LOWER(to_email) = ? AND type = 0 AND is_del = 0 AND status IN (0, 7)"
      ).bind(Number(id), inbox).first();
      if (!row) {
        return new Response(page("没找到", `<h1>没找到这封邮件</h1><div class="sub">可能已超过 7 天被自动清理</div><a class="btn" href="/?inbox=${encodeURIComponent(inbox)}">← 回到收件箱</a>`), { headers, status: 404 });
      }
      const text = (row.text && row.text.trim()) ? row.text : htmlToText(row.content);
      const body = `<h1 class="subj">${esc(row.subject) || "(无主题)"}</h1>
<div class="meta">发件人：${esc(row.name ? row.name + " <" + row.send_email + ">" : row.send_email)}<br>收件人：${esc(inbox)}<br>时间：${fmtTime(row.create_time)}（北京时间）</div>
${row.code ? `<div class="code">${esc(row.code)}</div>` : ""}
<div class="card" style="margin-top:14px"><pre>${esc(text) || "(无正文)"}</pre></div>
<a class="btn" href="/?inbox=${encodeURIComponent(inbox)}">← 回到收件箱</a>`;
      return new Response(page(row.subject || "邮件详情", body), { headers });
    }

    const { results } = await env.db.prepare(
      "SELECT email_id, send_email, name, subject, code, create_time FROM email WHERE LOWER(to_email) = ? AND type = 0 AND is_del = 0 AND status IN (0, 7) ORDER BY email_id DESC LIMIT 50"
    ).bind(inbox).all();

    const list = results.length
      ? results.map((r) => `<a class="card" href="/?inbox=${encodeURIComponent(inbox)}&id=${r.email_id}">
<div class="subj">${esc(r.subject) || "(无主题)"}</div>
<div class="meta">${esc(r.send_email)} · ${fmtTime(r.create_time)}</div>
${r.code ? `<span class="code">${esc(r.code)}</span>` : ""}</a>`).join("")
      : `<div class="empty">这个地址还没有收到邮件<br>（只显示最近 7 天内的）</div>`;

    const body = `<h1>${esc(inbox)}</h1>
<div class="sub">共 ${results.length} 封 · 页面每 60 秒自动刷新 · 邮件保留 7 天</div>
${list}
<a class="btn" href="/">← 查其他地址</a>
<script>setTimeout(function(){location.reload()},60000)</script>`;
    return new Response(page(inbox + " 的收件箱", body), { headers });
  },
};
