/* Lake Point Villa — Guest Documents */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const P = window.LPVPDF;

  const KEYS = { settings: "lpv.settings", history: "lpv.history", draft: "lpv.draft" };
  const store = {
    get(k, fb) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };

  const DEFAULT_SETTINGS = { signer: "Zein Hamza", signerTitle: "Reservations Manager", currency: "USD", payDetails: "", useSignature: true };
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));

  /* ---------- helpers ---------- */
  const todayISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  function nightsBetween(a, b) {
    if (!a || !b) return 0;
    const n = Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
    return n > 0 ? n : 0;
  }
  function usedNumbers() { return new Set(store.get(KEYS.history, []).map(h => String(h.data.resNo))); }
  function genResNo() {
    const used = usedNumbers(); let n;
    do { n = String(94000 + Math.floor(Math.random() * 6000)); } while (used.has(n));
    return n;
  }
  function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function normalizePhone(p) {
    let d = String(p || "").replace(/[^\d+]/g, "");
    if (d.startsWith("+")) d = d.slice(1);
    else if (d.startsWith("00")) d = d.slice(2);
    else if (d.startsWith("0")) d = "256" + d.slice(1);   // local Ugandan number
    return d.replace(/\D/g, "");
  }
  let toastTimer;
  function toast(msg, ms = 4200) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), ms);
  }

  /* ---------- rooms & extras ---------- */
  function roomTemplate(r, i) {
    return `
      <div class="card item" data-kind="room">
        <div class="item-head">
          <span class="item-num">Room ${i + 1}</span>
          <button type="button" class="remove" data-remove aria-label="Remove room ${i + 1}">Remove</button>
        </div>
        <div class="row">
          <label for="g-${i}">Guest name(s)</label>
          <input id="g-${i}" data-f="guests" value="${esc(r.guests)}" placeholder="e.g. Robert &amp; Melissa LeCompte" autocapitalize="words">
        </div>
        <div class="row">
          <label for="t-${i}">Room type</label>
          <input id="t-${i}" data-f="type" list="room-types" value="${esc(r.type)}" placeholder="Choose or type a room type">
        </div>
        <div class="row two">
          <div>
            <label for="p-${i}">Adults</label>
            <input id="p-${i}" data-f="pax" type="number" min="0" step="1" inputmode="numeric" value="${esc(r.pax)}">
          </div>
          <div>
            <label for="r-${i}">Rate / night</label>
            <input id="r-${i}" data-f="rate" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(r.rate)}" placeholder="0">
          </div>
        </div>
      </div>`;
  }
  function extraTemplate(e, i) {
    return `
      <div class="card item" data-kind="extra">
        <div class="item-head">
          <span class="item-num">Charge ${i + 1}</span>
          <button type="button" class="remove" data-remove aria-label="Remove charge ${i + 1}">Remove</button>
        </div>
        <div class="row three">
          <div>
            <label for="ed-${i}">Description</label>
            <input id="ed-${i}" data-f="desc" list="extra-types" value="${esc(e.desc)}">
          </div>
          <div>
            <label for="eq-${i}">Qty</label>
            <input id="eq-${i}" data-f="qty" type="number" min="0" step="1" inputmode="numeric" value="${esc(e.qty)}">
          </div>
          <div>
            <label for="ep-${i}">Unit price</label>
            <input id="ep-${i}" data-f="price" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(e.price)}" placeholder="0">
          </div>
        </div>
      </div>`;
  }
  function readItems(container) {
    return $$(".item", container).map(card => {
      const o = {}; $$("[data-f]", card).forEach(inp => { o[inp.dataset.f] = inp.value; }); return o;
    });
  }
  function renderRooms(list) {
    const c = $("#rooms"); c.innerHTML = list.map(roomTemplate).join("");
    $$("[data-remove]", c).forEach(b => b.hidden = list.length === 1);
  }
  function renderExtras(list) { $("#extras").innerHTML = list.map(extraTemplate).join(""); }

  /* ---------- form <-> data ---------- */
  let mode = "confirmation";
  function readForm() {
    const v = id => $("#" + id).value.trim();
    const rooms = readItems($("#rooms")).map(r => ({ guests: r.guests.trim(), type: r.type.trim(), pax: r.pax, rate: r.rate }));
    const extras = readItems($("#extras")).map(e => ({ desc: e.desc.trim(), qty: e.qty, price: e.price }));
    return {
      mode,
      resNo: v("resNo"), bookingDate: v("bookingDate"), checkIn: v("checkIn"), checkOut: v("checkOut"),
      nights: nightsBetween(v("checkIn"), v("checkOut")) || 1,
      rooms, extras,
      invNo: v("invNo"), invDate: v("invDate"), dueDate: v("dueDate"),
      amountPaid: v("amountPaid"), payMethod: v("payMethod"),
      guestPhone: v("guestPhone"), guestEmail: v("guestEmail"),
      signer: v("signer"), signerTitle: v("signerTitle"), currency: v("currency"),
      payDetails: $("#payDetails").value, useSignature: $("#useSignature").checked,
    };
  }
  function fillForm(d) {
    ["resNo", "bookingDate", "checkIn", "checkOut", "invNo", "invDate", "dueDate", "amountPaid", "payMethod", "guestPhone", "guestEmail"]
      .forEach(k => { $("#" + k).value = d[k] ?? ""; });
    $("#invNo").dataset.touched = d.invNo && d.invNo !== "INV-" + d.resNo ? "1" : "";
    renderRooms(d.rooms && d.rooms.length ? d.rooms : [blankRoom()]);
    renderExtras(d.extras || []);
    setMode(d.mode || "confirmation", false);
  }
  const blankRoom = () => ({ guests: "", type: "Standard Double Room", pax: 2, rate: "" });

  function freshDoc() {
    const resNo = genResNo();
    const t = todayISO();
    return { mode, resNo, bookingDate: t, checkIn: "", checkOut: "", rooms: [blankRoom()], extras: [], invNo: "INV-" + resNo, invDate: t, dueDate: t, amountPaid: "", payMethod: "", guestPhone: "", guestEmail: "" };
  }

  function applySettings(s) {
    $("#signer").value = s.signer; $("#signerTitle").value = s.signerTitle;
    $("#currency").value = s.currency; $("#payDetails").value = s.payDetails; $("#useSignature").checked = s.useSignature !== false;
  }
  function saveSettings() {
    store.set(KEYS.settings, { signer: $("#signer").value, signerTitle: $("#signerTitle").value, currency: $("#currency").value, payDetails: $("#payDetails").value, useSignature: $("#useSignature").checked });
  }

  /* ---------- derived UI ---------- */
  function updateDerived() {
    const d = readForm();
    const n = nightsBetween(d.checkIn, d.checkOut);
    const hint = $("#nights-hint");
    const bad = d.checkIn && d.checkOut && !n;
    $("#checkOut").setAttribute("aria-invalid", bad ? "true" : "false");
    hint.textContent = bad ? "Check-out must be after check-in." : n ? `${n} night${n === 1 ? "" : "s"} · ${P.longDate(d.checkIn)} – ${P.longDate(d.checkOut)}` : "Pick dates to count nights.";

    if (!$("#invNo").dataset.touched) $("#invNo").value = d.resNo ? "INV-" + d.resNo : "";

    const t = P.invoiceTotals(d);
    const cur = d.currency;
    $("#totals").innerHTML =
      `<div><span>Subtotal</span><span>${P.money(t.subtotal, cur)}</span></div>` +
      (t.paid ? `<div><span>Paid</span><span>–${P.money(t.paid, cur)}</span></div>` : "") +
      `<div class="grand"><span>${t.balance <= 0 && t.subtotal ? "Paid in full" : "Balance due"}</span><span>${P.money(Math.max(t.balance, 0), cur)}</span></div>`;

    const names = d.rooms.map(r => r.guests).filter(Boolean);
    const label = mode === "invoice" ? `Invoice <strong>${esc(d.invNo || "—")}</strong>` : `Confirmation <strong>${esc(d.resNo || "—")}</strong>`;
    $("#doc-label").innerHTML = `${label}${names.length ? " · " + esc(names[0]) + (names.length > 1 ? ` +${names.length - 1}` : "") : ""}`;
  }

  /* ---------- PDF ---------- */
  async function build(d = readForm()) {
    return d.mode === "invoice" ? P.buildInvoice(d) : P.buildConfirmation(d);
  }
  function fileName(d) {
    const first = (d.rooms.find(r => r.guests) || {}).guests || "Guest";
    const who = first.split(/&| and /)[0].trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z\d]+/g, "-").replace(/^-|-$/g, "") || "Guest";
    return d.mode === "invoice" ? `LPV-Invoice-${d.invNo || d.resNo}-${who}.pdf` : `LPV-Confirmation-${d.resNo}-${who}.pdf`;
  }

  let previewUrl = null, previewTimer = null, previewSeq = 0;
  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(renderPreview, 350);
  }
  async function renderPreview() {
    if (getComputedStyle($(".preview")).display === "none") return;
    if (navigator.pdfViewerEnabled === false) {
      $("#preview-empty").hidden = false;
      $("#preview-empty").textContent = "This browser can't show PDFs inline. Use Download to view the document.";
      return;
    }
    const seq = ++previewSeq;
    try {
      const doc = await build();
      if (seq !== previewSeq) return;
      const url = URL.createObjectURL(doc.output("blob"));
      $("#preview-frame").src = url + "#toolbar=0&navpanes=0&view=FitH";
      $("#preview-empty").hidden = true;
      if (previewUrl) setTimeout(((u) => () => URL.revokeObjectURL(u))(previewUrl), 1500);
      previewUrl = url;
    } catch (e) {
      console.error(e);
      $("#preview-empty").hidden = false;
      $("#preview-empty").textContent = "Preview unavailable. " + (e.message || "");
    }
  }

  function validate(d) {
    const problems = [];
    $$("[aria-invalid='true']").forEach(el => el.setAttribute("aria-invalid", "false"));
    const flag = (el, msg) => { el.setAttribute("aria-invalid", "true"); problems.push([el, msg]); };
    if (!d.resNo) flag($("#resNo"), "Add a reservation number.");
    if (!d.checkIn) flag($("#checkIn"), "Add the check-in date.");
    if (!d.checkOut) flag($("#checkOut"), "Add the check-out date.");
    else if (!nightsBetween(d.checkIn, d.checkOut)) flag($("#checkOut"), "Check-out must be after check-in.");
    $$("#rooms .item").forEach((card, i) => {
      const g = $("[data-f=guests]", card), r = $("[data-f=rate]", card);
      if (!g.value.trim()) flag(g, `Add guest name(s) for room ${i + 1}.`);
      if (r.value === "") flag(r, `Add the nightly rate for room ${i + 1}.`);
    });
    if (problems.length) { problems[0][0].focus(); toast(problems[0][1]); return false; }
    return true;
  }

  function remember(d) {
    const h = store.get(KEYS.history, []).filter(x => !(x.data.mode === d.mode && x.data.resNo === d.resNo));
    h.unshift({ at: Date.now(), data: d });
    store.set(KEYS.history, h.slice(0, 40));
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function messageFor(d) {
    const names = P.joinNames(d.rooms.map(r => r.guests));
    const stay = `${P.longDate(d.checkIn)} – ${P.longDate(d.checkOut)} (${d.nights} night${d.nights === 1 ? "" : "s"})`;
    const sign = `Kind regards,\n${d.signer || "Zein Hamza"}\n${d.signerTitle || "Reservations Manager"}, Lake Point Villa\n+256 702 212 223 · reservations@lakepointvilla.com`;
    if (d.mode === "invoice") {
      const t = P.invoiceTotals(d);
      const bal = t.balance > 0 ? `The balance due is ${P.money(t.balance, d.currency)}.` : "This invoice is paid in full — thank you.";
      return {
        subject: `Invoice ${d.invNo} – Lake Point Villa (Reservation ${d.resNo})`,
        body: `Dear ${names},\n\nPlease find attached invoice ${d.invNo} for your stay at Lake Point Villa, ${stay}. ${bal}\n\nShould you have any questions, please don't hesitate to contact us.\n\n${sign}`,
      };
    }
    return {
      subject: `Reservation Confirmation ${d.resNo} – Lake Point Villa`,
      body: `Dear ${names},\n\nThank you for choosing Lake Point Villa. Please find attached your reservation confirmation (No. ${d.resNo}) for ${stay}.\n\nWe look forward to welcoming you.\n\n${sign}`,
    };
  }

  async function withBusy(btn, fn) {
    const all = $$(".actions .btn"); all.forEach(b => b.disabled = true);
    try { await fn(); } catch (e) { console.error(e); toast("Something went wrong making the PDF. Please try again."); }
    finally { all.forEach(b => b.disabled = false); }
  }

  async function prepare() {
    const d = readForm();
    if (!validate(d)) return null;
    const doc = await build(d);
    const blob = doc.output("blob");
    const name = fileName(d);
    remember(d);
    return { d, blob, name, file: new File([blob], name, { type: "application/pdf" }) };
  }

  async function onDownload() {
    const r = await prepare(); if (!r) return;
    download(r.blob, r.name);
    toast(`Saved ${r.name}`);
  }

  async function onWhatsApp() {
    // Open the tab now, inside the click, so pop-up blockers allow it.
    const canShareFiles = isMobile && navigator.canShare && navigator.canShare({ files: [new File([""], "x.pdf", { type: "application/pdf" })] });
    const win = canShareFiles ? null : window.open("", "_blank");
    const r = await prepare(); if (!r) { win && win.close(); return; }
    const msg = messageFor(r.d);
    if (canShareFiles) {
      try { await navigator.share({ files: [r.file], text: msg.body }); return; }
      catch (e) { if (e.name === "AbortError") return; }
    }
    download(r.blob, r.name);
    const phone = normalizePhone(r.d.guestPhone);
    const text = encodeURIComponent(msg.body);
    const url = isMobile
      ? `https://wa.me/${phone}?text=${text}`
      : `https://web.whatsapp.com/send?${phone ? "phone=" + phone + "&" : ""}text=${text}`;
    if (win) win.location.href = url; else window.open(url, "_blank");
    toast(`PDF downloaded — attach ${r.name} in the WhatsApp chat (use the paperclip or drag it in).`, 7000);
  }

  async function onEmail() {
    const r = await prepare(); if (!r) return;
    download(r.blob, r.name);
    const msg = messageFor(r.d);
    const href = `mailto:${encodeURIComponent(r.d.guestEmail || "")}?subject=${encodeURIComponent(msg.subject)}&body=${encodeURIComponent(msg.body)}`;
    setTimeout(() => { const a = document.createElement("a"); a.href = href; a.click(); }, 300);
    toast(`PDF downloaded — attach ${r.name} to the email.`, 7000);
  }

  async function onPreviewMobile() {
    const r = await prepare(); if (!r) return;
    const url = URL.createObjectURL(r.blob);
    window.open(url, "_blank") || download(r.blob, r.name);
  }

  /* ---------- mode ---------- */
  function setMode(m, render = true) {
    mode = m;
    document.body.dataset.mode = m;
    $$(".segmented [role=tab]").forEach(b => { const on = b.dataset.mode === m; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1; });
    if (render) onChange();
  }

  /* ---------- recent ---------- */
  function openRecent() {
    const h = store.get(KEYS.history, []);
    $("#recent-list").innerHTML = h.length ? h.map((x, i) => {
      const d = x.data; const names = d.rooms.map(r => r.guests).filter(Boolean).join(", ") || "Guest";
      return `<li><button type="button" data-i="${i}">
        <span class="r-name">${esc(names)}</span>
        <span class="r-meta">${esc(d.mode === "invoice" ? d.invNo : "No. " + d.resNo)} · ${esc(P.longDate(d.checkIn))} – ${esc(P.longDate(d.checkOut))}</span>
        <span class="r-type">${d.mode === "invoice" ? "Invoice" : "Confirmation"}</span>
      </button></li>`;
    }).join("") : `<li class="recent-empty">Documents you download or send appear here.</li>`;
    $("#recent-dialog").showModal();
  }

  /* ---------- wiring ---------- */
  function saveDraft() { const d = readForm(); store.set(KEYS.draft, d); }
  function onChange() { updateDerived(); schedulePreview(); saveDraft(); }

  function init() {
    applySettings({ ...DEFAULT_SETTINGS, ...store.get(KEYS.settings, {}) });
    const draft = store.get(KEYS.draft, null);
    fillForm(draft && draft.resNo ? draft : freshDoc());

    $("#doc-form").addEventListener("input", (e) => {
      if (e.target.id === "invNo") e.target.dataset.touched = e.target.value ? "1" : "";
      if (e.target.closest(".settings")) saveSettings();
      if (e.target.getAttribute("aria-invalid") === "true" && e.target.value) e.target.setAttribute("aria-invalid", "false");
      onChange();
    });
    $("#doc-form").addEventListener("change", (e) => { if (e.target.closest(".settings")) saveSettings(); onChange(); });
    $("#doc-form").addEventListener("submit", e => e.preventDefault());

    $("#checkIn").addEventListener("change", () => {
      const ci = $("#checkIn").value, co = $("#checkOut").value;
      if (ci && (!co || co <= ci)) { const [y, m, dd] = ci.split("-").map(Number); $("#checkOut").value = new Date(Date.UTC(y, m - 1, dd + 1)).toISOString().slice(0, 10); }
      if (ci && !$("#dueDate").dataset.touched) $("#dueDate").value = ci;
      onChange();
    });
    $("#dueDate").addEventListener("input", e => e.target.dataset.touched = "1");

    $("#regen-res").addEventListener("click", () => { $("#resNo").value = genResNo(); onChange(); });
    $("#regen-inv").addEventListener("click", () => { $("#invNo").dataset.touched = ""; onChange(); });

    $("#add-room").addEventListener("click", () => {
      const list = readItems($("#rooms")); list.push(blankRoom()); renderRooms(list);
      $$("#rooms [data-f=guests]").pop().focus(); onChange();
    });
    $("#add-extra").addEventListener("click", () => {
      const list = readItems($("#extras")); list.push({ desc: "", qty: 1, price: "" }); renderExtras(list);
      $$("#extras [data-f=desc]").pop().focus(); onChange();
    });
    ["rooms", "extras"].forEach(id => $("#" + id).addEventListener("click", (e) => {
      const btn = e.target.closest("[data-remove]"); if (!btn) return;
      const cards = $$(".item", $("#" + id)); const idx = cards.indexOf(btn.closest(".item"));
      const list = readItems($("#" + id)); list.splice(idx, 1);
      id === "rooms" ? renderRooms(list) : renderExtras(list);
      onChange();
    }));

    $$(".segmented [role=tab]").forEach(b => {
      b.addEventListener("click", () => setMode(b.dataset.mode));
      b.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        const next = b.dataset.mode === "confirmation" ? "invoice" : "confirmation";
        setMode(next); $(`[data-mode=${next}]`).focus();
      });
    });

    $("#btn-new").addEventListener("click", () => { fillForm(freshDoc()); $("#dueDate").dataset.touched = ""; onChange(); $("#g-0").focus(); toast("New document started"); });
    $("#btn-recent").addEventListener("click", openRecent);
    $("#recent-close").addEventListener("click", () => $("#recent-dialog").close());
    $("#recent-dialog").addEventListener("click", (e) => {
      if (e.target === e.currentTarget) return e.currentTarget.close();
      const b = e.target.closest("[data-i]"); if (!b) return;
      const item = store.get(KEYS.history, [])[+b.dataset.i]; if (!item) return;
      fillForm(item.data); onChange(); $("#recent-dialog").close(); toast("Loaded — edit and send again");
    });

    $("#btn-download").addEventListener("click", (e) => withBusy(e.currentTarget, onDownload));
    $("#btn-whatsapp").addEventListener("click", (e) => withBusy(e.currentTarget, onWhatsApp));
    $("#btn-email").addEventListener("click", (e) => withBusy(e.currentTarget, onEmail));
    $("#btn-preview").addEventListener("click", (e) => withBusy(e.currentTarget, onPreviewMobile));

    window.matchMedia("(max-width: 1000px)").addEventListener("change", schedulePreview);

    P.loadAssets().catch(() => toast("Couldn't load fonts or images. Check your connection and reload."));
    onChange();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
