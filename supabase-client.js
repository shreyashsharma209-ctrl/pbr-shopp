// Supabase se jodne wali file. Poori website isi "PBR.db" ka use karti hai.
window.PBR = window.PBR || {};
(function () {
  const c = window.PBR_CONFIG;
  if (!c || c.SUPABASE_URL.startsWith("PASTE") || c.SUPABASE_ANON_KEY.startsWith("PASTE")) {
    window.PBR.configError = "config.js me Supabase URL aur key abhi paste nahi hui hai.";
    return;
  }
  window.PBR.db = window.supabase.createClient(c.SUPABASE_URL, c.SUPABASE_ANON_KEY);
})();

// Chhote helper: DOM banana (textContent se, taaki koi galat text code ban kar na chale)
PBR.el = function (tag, attrs, ...kids) {
  const e = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([k, v]) => (k === "class" ? (e.className = v) : e.setAttribute(k, v)));
  kids.forEach(k => e.append(k));
  return e;
};
// Rupaye ka format: ₹12,500
PBR.inr = n => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
// Bharat ki date (YYYY-MM-DD) - computer ka timezone kuch bhi ho
PBR.todayIST = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
PBR.addDays = (d, n) => { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
