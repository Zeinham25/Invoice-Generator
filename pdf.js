/* PDF builders for Lake Point Villa guest documents (jsPDF + autotable). */
(function () {
  const { jsPDF } = window.jspdf;

  const PROPERTY = {
    name: "Lake Point Villa",
    address: ["Plot 6 Research Close", "Virus, Entebbe-Uganda"],
    tel: "+256 394 847077",
    mobile: "+256 702 212 223 (WhatsApp)",
    emails: ["lakepointvilla@gmail.com", "reservations@lakepointvilla.com"],
    web: "lakepointvilla.com",
  };

  const HOUSE_RULES = [
    ["Check-in", "From 11:00 to 23:30"],
    ["Check-out", "From 07:00 to 10:00"],
    ["Children and beds", "Children of any age are welcome. Children aged 12 years and above are considered adults at this property."],
    ["Cost and extra bed policies", "Extra bed upon request: US$30 per person, per night. Prices for extra beds are not included in the total price and will have to be paid for separately during your stay. The number of extra beds allowed is dependent on the option you choose."],
    ["No age restriction", "There is no age requirement for check-in."],
    ["Pets", "Pets are allowed on request. Charges may be applicable."],
  ];

  const TEAL = [26, 143, 168];
  const INK = [28, 36, 42];
  const GREY = [84, 96, 104];
  const LINE = [214, 222, 226];
  const ZEBRA = [241, 247, 249];

  const M = 20;            // page margin (mm)
  const W = 210, H = 297;  // A4
  const CW = W - 2 * M;    // content width

  /* ---------- assets ---------- */
  let assetsPromise = null;
  function toBase64(buf) {
    let s = ""; const b = new Uint8Array(buf); const chunk = 0x8000;
    for (let i = 0; i < b.length; i += chunk) s += String.fromCharCode.apply(null, b.subarray(i, i + chunk));
    return btoa(s);
  }
  async function fetchB64(url) { const r = await fetch(url); if (!r.ok) throw new Error("Could not load " + url); return toBase64(await r.arrayBuffer()); }
  function loadAssets() {
    if (!assetsPromise) {
      assetsPromise = Promise.all([
        fetchB64("fonts/Montserrat-Regular.ttf"),
        fetchB64("fonts/Montserrat-SemiBold.ttf"),
        fetchB64("fonts/Montserrat-Bold.ttf"),
        fetchB64("assets/logo.jpg"),
        fetchB64("assets/signature.png"),
      ]).then(([reg, semi, bold, logo, sig]) => ({ reg, semi, bold, logo: "data:image/jpeg;base64," + logo, sig: "data:image/png;base64," + sig }));
    }
    return assetsPromise;
  }

  function newDoc(A, title) {
    const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
    doc.addFileToVFS("Montserrat-Regular.ttf", A.reg); doc.addFont("Montserrat-Regular.ttf", "Montserrat", "normal");
    doc.addFileToVFS("Montserrat-Bold.ttf", A.bold); doc.addFont("Montserrat-Bold.ttf", "Montserrat", "bold");
    doc.addFileToVFS("Montserrat-SemiBold.ttf", A.semi); doc.addFont("Montserrat-SemiBold.ttf", "MontserratSemi", "normal");
    doc.setFont("Montserrat", "normal");
    doc.setProperties({ title, author: PROPERTY.name, creator: PROPERTY.name });
    return doc;
  }

  /* ---------- formatting ---------- */
  function money(n, cur) {
    const v = Number(n) || 0;
    if (cur === "UGX") return "UGX " + Math.round(v).toLocaleString("en-US");
    const sym = cur === "EUR" ? "€" : "$";
    const neg = v < 0 ? "-" : "";
    const a = Math.abs(v);
    const s = Number.isInteger(a) ? a.toLocaleString("en-US") : a.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return neg + sym + s;
  }
  function usDate(iso) {
    if (!iso) return "—";
    const [y, m, d] = iso.split("-");
    return `${m}/${d}/${y}`;
  }
  function longDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }
  function joinNames(list) {
    const n = list.filter(Boolean);
    if (n.length <= 1) return n[0] || "Guest";
    return n.slice(0, -1).join(", ") + " and " + n[n.length - 1];
  }

  /* ---------- layout helpers ---------- */
  function setF(doc, style, size, color) {
    if (style === "semi") doc.setFont("MontserratSemi", "normal");
    else doc.setFont("Montserrat", style === "bold" ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...(color || INK));
  }
  const lh = (pt, f = 1.42) => pt * 0.3528 * f; // line height mm

  function ensure(doc, y, need) {
    if (y + need > H - 16) { doc.addPage(); return 20; }
    return y;
  }

  function header(doc, A) {
    const logoW = 30, logoH = logoW * 361 / 473;
    doc.addImage(A.logo, "JPEG", M - 1, 12, logoW, logoH);
    setF(doc, "normal", 8.4, GREY);
    const lines = [...PROPERTY.address, "Tel: " + PROPERTY.tel, "Mobile: " + PROPERTY.mobile, ...PROPERTY.emails];
    let y = 15;
    lines.forEach(l => { doc.text(l, W - M, y, { align: "right" }); y += lh(8.4, 1.45); });
    const ruleY = Math.max(12 + logoH, y) + 3;
    doc.setDrawColor(...TEAL); doc.setLineWidth(0.6); doc.line(M, ruleY, W - M, ruleY);
    return ruleY + 7.5;
  }

  function para(doc, text, y, size = 9.6, color = INK, width = CW) {
    setF(doc, "normal", size, color);
    const lines = doc.splitTextToSize(text, width);
    y = ensure(doc, y, lines.length * lh(size));
    doc.text(lines, M, y, { lineHeightFactor: 1.42 });
    return y + lines.length * lh(size);
  }

  function h2(doc, text, y) {
    y = ensure(doc, y + 3, 12);
    setF(doc, "semi", 11.5, TEAL);
    doc.text(text, M, y);
    return y + 6;
  }

  // Bold label followed by wrapped regular text on the same line.
  function richRule(doc, label, body, y, size = 8.5) {
    const words = body.split(" ");
    setF(doc, "bold", size, INK);
    const lab = label + ": ";
    const labW = doc.getTextWidth(lab);
    setF(doc, "normal", size, GREY);
    const lines = []; let cur = ""; let avail = CW - labW;
    words.forEach(w => {
      const t = cur ? cur + " " + w : w;
      if (doc.getTextWidth(t) > avail && cur) { lines.push(cur); cur = w; avail = CW; }
      else cur = t;
    });
    if (cur) lines.push(cur);
    y = ensure(doc, y, lines.length * lh(size));
    setF(doc, "bold", size, INK); doc.text(lab, M, y);
    setF(doc, "normal", size, GREY);
    lines.forEach((l, i) => { doc.text(l, i === 0 ? M + labW : M, y); y += lh(size); });
    return y + 0.6;
  }

  const SIG_H = 38 * 334 / 608 + 3 * lh(9.7) + 2;
  function signatureBlock(doc, A, d, y) {
    y = ensure(doc, y + 2, SIG_H);
    if (d.useSignature) {
      const sw = 38, sh = sw * 334 / 608;
      doc.addImage(A.sig, "PNG", M - 2, y - 2, sw, sh);
      y += sh - 1;
    } else {
      y += 6;
    }
    setF(doc, "bold", 9.8, INK); doc.text(d.signer || "Zein Hamza", M, y); y += lh(9.8);
    setF(doc, "normal", 9.6, INK); doc.text(d.signerTitle || "Reservations Manager", M, y); y += lh(9.6);
    doc.text(PROPERTY.name, M, y);
    return y + lh(9.6);
  }

  function footer(doc) {
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.line(M, H - 13, W - M, H - 13);
      setF(doc, "normal", 7.4, GREY);
      doc.text(`${PROPERTY.name} · ${PROPERTY.address.join(", ")} · ${PROPERTY.web}`, M, H - 9);
      if (n > 1) doc.text(`Page ${i} of ${n}`, W - M, H - 9, { align: "right" });
    }
  }

  function kv(doc, rows, y, x = M, labW = 40, size = 9.6) {
    rows.forEach(([k, v]) => {
      y = ensure(doc, y, lh(size));
      setF(doc, "bold", size, INK); doc.text(k, x, y);
      setF(doc, "normal", size, INK); doc.text(String(v), x + labW, y);
      y += lh(size, 1.45);
    });
    return y;
  }

  const tableBase = (doc) => ({
    margin: { left: M, right: M, bottom: 18 },
    styles: { font: "Montserrat", fontSize: 8.8, textColor: INK, cellPadding: { top: 2.4, bottom: 2.4, left: 2.6, right: 2.6 }, lineColor: LINE, lineWidth: { bottom: 0.2 } },
    headStyles: { font: "Montserrat", fontStyle: "bold", fillColor: TEAL, textColor: [255, 255, 255], lineWidth: 0 },
    alternateRowStyles: { fillColor: ZEBRA },
  });

  /* ---------- Reservation confirmation ---------- */
  async function buildConfirmation(d, compact = false) {
    const A = await loadAssets();
    const doc = newDoc(A, `Reservation Confirmation ${d.resNo}`);
    const cur = d.currency;
    let y = header(doc, A);

    setF(doc, "semi", 13, TEAL); doc.text("RESERVATION CONFIRMATION", M, y); y += 7;
    y = para(doc, `Dear ${joinNames(d.rooms.map(r => r.guests))},`, y);
    y += 1.5;
    y = para(doc, "We are delighted to confirm your reservation. We appreciate your choice to stay with us and look forward to providing you with a memorable experience.", y);

    y = h2(doc, "Reservation Details", y - 1);
    const pax = d.rooms.reduce((s, r) => s + (Number(r.pax) || 0), 0);
    const rows = [
      ["Reservation No:", d.resNo],
      ["Reservation Date:", usDate(d.bookingDate)],
      ["Check-in:", usDate(d.checkIn)],
      ["Check-out:", usDate(d.checkOut)],
      ["Length of Stay:", `${d.nights} Night${d.nights === 1 ? "" : "s"}`],
    ];
    if (pax) rows.push(["Number of Guests:", `${pax} Adult${pax === 1 ? "" : "s"}`]);
    rows.push(["Number of Rooms:", String(d.rooms.length)]);
    y = kv(doc, rows, y + 1);

    y = h2(doc, "Guests & Rooms", y);
    const total = d.rooms.reduce((s, r) => s + (Number(r.rate) || 0) * d.nights, 0);
    doc.autoTable({
      ...tableBase(doc),
      startY: y - 2,
      ...(compact ? { styles: { ...tableBase(doc).styles, cellPadding: { top: 1.5, bottom: 1.5, left: 2.6, right: 2.6 } } } : {}),
      head: [["Guest Name(s)", "Room Type", "Nights", "Price / Night", "Total"]],
      body: d.rooms.map(r => [r.guests || "—", r.type || "—", String(d.nights), money(r.rate, cur), money((Number(r.rate) || 0) * d.nights, cur)]),
      foot: [[{ content: "", colSpan: 3, styles: { fillColor: false } }, "Total Price", money(total, cur)]],
      footStyles: { font: "Montserrat", fontStyle: "bold", fillColor: false, textColor: INK, lineWidth: 0, halign: "center" },
      columnStyles: { 0: { cellWidth: 58 }, 1: { cellWidth: 48 }, 2: { halign: "center", cellWidth: 18 }, 3: { halign: "center" }, 4: { halign: "center" } },
      didDrawCell: (c) => { if (c.section === "foot" && c.column.index >= 3) { doc.setDrawColor(...TEAL); doc.setLineWidth(0.5); doc.line(c.cell.x, c.cell.y, c.cell.x + c.cell.width, c.cell.y); } },
    });
    y = doc.lastAutoTable.finalY + 5;

    y = para(doc, "Should you require any further assistance or have any questions, please do not hesitate to contact our dedicated customer service team.", y);

    y = h2(doc, "House Rules", y);
    HOUSE_RULES.forEach(([k, v]) => { y = richRule(doc, k, v, y, compact ? 7.9 : 8.5); });

    y += 2.5;
    const closing = "We are eagerly awaiting your arrival and aim to make your stay exceptional. Thank you for choosing our establishment. We hope you have a wonderful experience with us.";
    setF(doc, "normal", 9.6); 
    y = ensure(doc, y, doc.splitTextToSize(closing, CW).length * lh(9.6) + SIG_H + 4);  // keep closing + signature together
    y = para(doc, closing, y);
    signatureBlock(doc, A, d, y + 1);
    // Try a tighter layout before spilling onto a second page.
    if (!compact && doc.getNumberOfPages() > 1) return buildConfirmation(d, true);
    footer(doc);
    return doc;
  }

  /* ---------- Invoice ---------- */
  function invoiceTotals(d) {
    const rooms = d.rooms.reduce((s, r) => s + (Number(r.rate) || 0) * d.nights, 0);
    const extras = d.extras.reduce((s, e) => s + (Number(e.qty) || 0) * (Number(e.price) || 0), 0);
    const subtotal = rooms + extras;
    const paid = Number(d.amountPaid) || 0;
    return { rooms, extras, subtotal, paid, balance: subtotal - paid };
  }

  async function buildInvoice(d) {
    const A = await loadAssets();
    const doc = newDoc(A, `Invoice ${d.invNo}`);
    const cur = d.currency;
    const t = invoiceTotals(d);
    let y = header(doc, A);
    const top = y;

    setF(doc, "bold", 22, TEAL); doc.text("INVOICE", M, y + 4);

    // meta block (right)
    const mx = W - M - 70;
    let my = top - 1;
    [["Invoice No.", d.invNo], ["Invoice date", usDate(d.invDate)], ["Due date", usDate(d.dueDate)], ["Reservation No.", d.resNo]].forEach(([k, v]) => {
      setF(doc, "normal", 8.6, GREY); doc.text(k, mx, my);
      setF(doc, "semi", 9.2, INK); doc.text(String(v || "—"), W - M, my, { align: "right" });
      my += 5.4;
    });

    // Bill to + stay
    y = Math.max(y + 14, my + 4);
    const colW = CW / 2 - 4;
    setF(doc, "semi", 8.4, TEAL); doc.text("BILLED TO", M, y); doc.text("STAY", M + CW / 2 + 4, y);
    let by = y + 5.5;
    const names = d.rooms.map(r => r.guests).filter(Boolean);
    setF(doc, "bold", 9.8, INK);
    const nameLines = doc.splitTextToSize(names.length ? names.join("\n") : "Guest", colW);
    doc.text(nameLines, M, by, { lineHeightFactor: 1.42 }); by += nameLines.length * lh(9.8);
    setF(doc, "normal", 9, GREY);
    if (d.guestPhone) { doc.text(d.guestPhone, M, by); by += lh(9); }
    if (d.guestEmail) { doc.text(d.guestEmail, M, by); by += lh(9); }

    let sy = y + 5.5;
    const sx = M + CW / 2 + 4;
    setF(doc, "bold", 9.8, INK); doc.text(`${longDate(d.checkIn)} – ${longDate(d.checkOut)}`, sx, sy); sy += lh(9.8);
    setF(doc, "normal", 9, GREY);
    doc.text(`${d.nights} night${d.nights === 1 ? "" : "s"} · ${d.rooms.length} room${d.rooms.length === 1 ? "" : "s"}`, sx, sy); sy += lh(9);
    doc.text(`Booked ${longDate(d.bookingDate)}`, sx, sy); sy += lh(9);

    y = Math.max(by, sy) + 7;

    const body = [];
    d.rooms.forEach(r => {
      body.push([{ content: (r.type || "Room") + (r.guests ? "\n" + r.guests : "") }, `${d.nights} night${d.nights === 1 ? "" : "s"}`, money(r.rate, cur), money((Number(r.rate) || 0) * d.nights, cur)]);
    });
    d.extras.filter(e => e.desc || Number(e.price)).forEach(e => {
      body.push([e.desc || "Charge", String(Number(e.qty) || 0), money(e.price, cur), money((Number(e.qty) || 0) * (Number(e.price) || 0), cur)]);
    });

    doc.autoTable({
      ...tableBase(doc),
      startY: y,
      head: [["Description", "Qty", "Rate", "Amount"]],
      body,
      columnStyles: { 0: { cellWidth: 92 }, 1: { halign: "center" }, 2: { halign: "right" }, 3: { halign: "right", font: "MontserratSemi" } },
      headStyles: { ...tableBase(doc).headStyles, halign: "left" },
      didParseCell: (c) => { if (c.section === "head" && c.column.index >= 2) c.cell.styles.halign = "right"; if (c.section === "head" && c.column.index === 1) c.cell.styles.halign = "center"; },
    });
    y = doc.lastAutoTable.finalY + 6;

    // totals
    y = ensure(doc, y, 34);
    const tx = W - M - 74;
    const line = (k, v, opts = {}) => {
      setF(doc, opts.bold ? "bold" : "normal", opts.size || 9.4, opts.color || INK);
      doc.text(k, tx, y);
      doc.text(v, W - M, y, { align: "right" });
      y += lh(opts.size || 9.4, 1.7);
    };
    line("Subtotal", money(t.subtotal, cur));
    if (t.paid) line(`Amount paid${d.payMethod ? " (" + d.payMethod + ")" : ""}`, "–" + money(t.paid, cur).replace("-", ""), { color: GREY });
    doc.setDrawColor(...TEAL); doc.setLineWidth(0.5); doc.line(tx, y - 3, W - M, y - 3);
    y += 2;
    line(t.balance <= 0 ? "Balance" : "Balance due", money(Math.max(t.balance, 0), cur), { bold: true, size: 12, color: TEAL });

    if (t.balance <= 0 && t.subtotal > 0) {
      // paid stamp
      const sx2 = M, sy2 = y - 14;
      doc.setDrawColor(...TEAL); doc.setLineWidth(0.6);
      doc.roundedRect(sx2, sy2, 38, 11, 2, 2);
      setF(doc, "bold", 11, TEAL); doc.text("PAID IN FULL", sx2 + 19, sy2 + 7.2, { align: "center" });
    }

    y += 4;
    if (d.payDetails && d.payDetails.trim()) {
      y = h2(doc, "Payment details", y);
      setF(doc, "normal", 9, INK);
      const pl = doc.splitTextToSize(d.payDetails.trim(), CW);
      y = ensure(doc, y, pl.length * lh(9));
      doc.text(pl, M, y, { lineHeightFactor: 1.42 }); y += pl.length * lh(9);
      if (d.resNo) { y += 1; setF(doc, "normal", 8.6, GREY); doc.text(`Please quote reference ${d.invNo || d.resNo} with your payment.`, M, y); y += lh(8.6); }
    }

    y += 4;
    setF(doc, "normal", 9.2);
    y = ensure(doc, y, 2 * lh(9.2) + SIG_H + 4);
    y = para(doc, "Thank you for choosing Lake Point Villa. Should you have any questions about this invoice, please contact us at reservations@lakepointvilla.com or +256 702 212 223 (WhatsApp).", y, 9.2);
    signatureBlock(doc, A, d, y + 2);
    footer(doc);
    return doc;
  }

  window.LPVPDF = { buildConfirmation, buildInvoice, invoiceTotals, money, longDate, joinNames, loadAssets };
})();
