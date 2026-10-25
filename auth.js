// Login / logout / page ki suraksha.
// Yaad rakhein: asli suraksha database ke RLS me hai; yeh sirf achha experience deta hai.
PBR.requireOwner = async function () {
  if (!PBR.db) { document.body.replaceChildren(PBR.el("p", { class: "fatal" }, PBR.configError)); return null; }
  const { data } = await PBR.db.auth.getSession();
  if (!data.session) { location.replace("login.html"); return null; }
  // Kya yeh sach me owner hai? (profiles me uski row honi chahiye)
  const { data: prof } = await PBR.db.from("profiles").select("role").eq("id", data.session.user.id).maybeSingle();
  if (!prof) {
    await PBR.db.auth.signOut();
    location.replace("login.html?denied=1");
    return null;
  }
  return data.session;
};
PBR.logout = async function () { await PBR.db.auth.signOut(); location.replace("login.html"); };
