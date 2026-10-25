// Dashboard: sab kuch database ke asli records se nikalta hai. Koi nakli number nahi.
(async function () {
  const $ = id => document.getElementById(id);
  const session = await PBR.requireOwner();
  if (!session) return;
  $("logoutBtn").onclick = PBR.logout;
  $("hanuman").onerror = function () { // tasveer abhi nahi lagi to saaf jagah dikhayein
    const d = PBR.el("div", { class: "hanuman" }, "Hanuman Ji ki tasveer yahan lagegi: hanuman.jpg");
    this.replaceWith(d);
  };

  // Subah / dopahar / shaam ka greeting (Bharat ke samay se)
  const hr = +new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }).format(new Date());
  const wish = hr < 12 ? "शुभ प्रभात" : hr < 17 ? "शुभ दोपहर" : "शुभ संध्या";
  $("greet").textContent = wish + " · " + new Intl.DateTimeFormat("hi-IN", { timeZone: "Asia/Kolkata", dateStyle: "full" }).format(new Date());

  let range = "today";
  function getRange() {
    const t = PBR.todayIST();
    if (range === "today") return [t, t];
    if (range === "yesterday") { const y = PBR.addDays(t, -1); return [y, y]; }
    if (range === "7d") return [PBR.addDays(t, -6), t];
    if (range === "month") return [t.slice(0, 8) + "01", t];
    return [$("from").value, $("to").value];
  }
  // Paise me jodte hain, taaki 0.1+0.2 jaisi galtiyan na hon
  const paise = n => Math.round(Number(n) * 100);
  const sum = (rows, f) => rows.reduce((a, r) => a + f(r), 0) / 100;

  // Database ek baar me 1000 rows deta hai, isliye page-by-page padhte hain
  async function fetchAll(table, cols, from, to, dateCol) {
    let all = [], start = 0;
    for (;;) {
      const { data, error } = await PBR.db.from(table).select(cols).gte(dateCol, from).lte(dateCol, to).order(dateCol, { ascending: false }).range(start, start + 999);
      if (error) throw error;
      all = all.concat(data);
      if (data.length < 1000) return all;
      start += 1000;
    }
  }
  const li = (a, b) => PBR.el("li", {}, PBR.el("span", {}, a), PBR.el("strong", {}, b));
  function fill(id, items, emptyText) {
    const ul = $(id); ul.replaceChildren();
    if (!items.length) ul.append(PBR.el("li", { class: "empty" }, emptyText)); else items.forEach(i => ul.append(i));
  }

  async function load() {
    const [from, to] = getRange();
    const st = $("status"); st.className = "status";
    if (!from || !to || from > to) { st.className = "status err"; st.textContent = "Sahi date chuniye (From, To se pehle honi chahiye)."; return; }
    st.textContent = "Load ho raha hai...";
    try {
      const t = PBR.todayIST(), m1 = t.slice(0, 8) + "01";
      const sCols = "sale_date,product_name,quantity,unit,total_amount,created_at", eCols = "expense_date,category,description,amount,created_at";
      const [sales, exps, monthS, monthE, todayS, todayE] = await Promise.all([
        fetchAll("sales_with_total", sCols, from, to, "sale_date"), fetchAll("expenses", eCols, from, to, "expense_date"),
        fetchAll("sales_with_total", "total_amount", m1, t, "sale_date"), fetchAll("expenses", "amount", m1, t, "expense_date"),
        fetchAll("sales_with_total", "total_amount", t, t, "sale_date"), fetchAll("expenses", "amount", t, t, "expense_date")]);

      $("todaySales").textContent = PBR.inr(sum(todayS, r => paise(r.total_amount)));
      $("todayExp").textContent = PBR.inr(sum(todayE, r => paise(r.amount)));
      $("monthSales").textContent = PBR.inr(sum(monthS, r => paise(r.total_amount)));
      $("monthExp").textContent = PBR.inr(sum(monthE, r => paise(r.amount)));
      const sTot = sum(sales, r => paise(r.total_amount)), eTot = sum(exps, r => paise(r.amount));
      $("diff").textContent = PBR.inr(sTot - eTot);

      // Best sellers (naam + unit ke hisaab se, kyunki kg aur piece ko jod nahi sakte)
      const by = {};
      sales.forEach(r => { const k = r.product_name + "|" + r.unit; by[k] = by[k] || { n: r.product_name, u: r.unit, q: 0, amt: 0 }; by[k].q += Number(r.quantity); by[k].amt += paise(r.total_amount); });
      fill("best", Object.values(by).sort((a, b) => b.amt - a.amt).slice(0, 5).map(x => li(x.n + " (" + +x.q.toFixed(3) + " " + x.u + ")", PBR.inr(x.amt / 100))), "Is samay ki koi bikri darj nahi hai.");

      // Roz ki bikri ka chart
      const day = {}; sales.forEach(r => (day[r.sale_date] = (day[r.sale_date] || 0) + paise(r.total_amount)));
      const days = []; for (let d = from; d <= to && days.length < 92; d = PBR.addDays(d, 1)) days.push(d);
      const max = Math.max(1, ...days.map(d => day[d] || 0)), tr = $("trend"); tr.replaceChildren();
      days.forEach(d => { const b = PBR.el("div", { class: "bar", title: d + ": " + PBR.inr((day[d] || 0) / 100) }); b.style.height = ((day[d] || 0) / max) * 100 + "%"; tr.append(b); });
      $("tFrom").textContent = from; $("tTo").textContent = to;

      fill("recentSales", sales.slice().sort((a, b) => (b.sale_date + b.created_at).localeCompare(a.sale_date + a.created_at)).slice(0, 5).map(r => li(r.sale_date + " · " + r.product_name, PBR.inr(r.total_amount))), "Abhi koi bikri nahi. Sales page agle stage me aayega.");
      fill("recentExp", exps.slice().sort((a, b) => (b.expense_date + b.created_at).localeCompare(a.expense_date + a.created_at)).slice(0, 5).map(r => li(r.expense_date + " · " + r.description, PBR.inr(r.amount))), "Abhi koi kharcha nahi.");

      // Kharche ki category-wise bar
      const cat = {}; exps.forEach(r => (cat[r.category] = (cat[r.category] || 0) + paise(r.amount)));
      const cmax = Math.max(1, ...Object.values(cat));
      fill("expCat", Object.entries(cat).sort((a, b) => b[1] - a[1]).map(([k, v]) => {
        const row = li(k, PBR.inr(v / 100)); const bar = PBR.el("div", { class: "bar" }); bar.style.cssText = "height:6px;width:" + (v / cmax) * 100 + "%;min-width:4px;border-radius:3px"; row.append(bar); row.style.flexWrap = "wrap"; return row;
      }), "Is samay ka koi kharcha nahi.");

      st.textContent = from === to ? "Dikha rahe hain: " + from : "Dikha rahe hain: " + from + " se " + to;
      $("saved").textContent = "Aakhri baar database se padha gaya: " + new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" });
    } catch (e) {
      st.className = "status err";
      st.textContent = "Data load nahi hua (" + (e.message || "network problem") + "). Internet check karke Refresh dabayein.";
    }
  }

  document.querySelectorAll(".filters [data-r]").forEach(b => (b.onclick = () => {
    range = b.dataset.r;
    document.querySelectorAll(".filters [data-r]").forEach(x => x.setAttribute("aria-pressed", x === b));
    $("customBox").hidden = range !== "custom";
    if (range !== "custom") load();
  }));
  $("applyCustom").onclick = load; $("refresh").onclick = load;
  load();
})();
