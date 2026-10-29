# LPV Guest Documents

A small static web app for making Lake Point Villa **reservation confirmations** and **guest invoices** as PDFs, with one click to send them by WhatsApp or email.

## Deploy to Vercel

There's no build step. It's plain HTML, CSS and JS.

1. Push this folder to a GitHub repo, or run `npx vercel` from inside it.
2. In Vercel: **Add New → Project → Import**, set Framework Preset to **Other** and leave Build Command empty.
3. Deploy.

**Strongly recommended:** turn on **Settings → Deployment Protection → Vercel Authentication** (or Password Protection) for production. `assets/signature.png` is served publicly unless the site is protected.

## Using it

- **Confirmation / Invoice**: switch at the top. Both use the same booking, so you can make the confirmation and then switch to make its invoice.
- **Reservation No.**: auto-generated (5 digits, never repeats one you've already used on this device). Type over it to use a real Beds24 number, or tap ↻ for a new one.
- **Invoice No.**: defaults to `INV-<reservation no.>`. It's editable, and ↻ resets it.
- **WhatsApp**: on phones it opens the share sheet with the PDF attached. On computers it downloads the PDF and opens WhatsApp Web with the message ready. Drag the PDF into the chat.
- **Email**: downloads the PDF and opens your mail app with the subject and message filled in. Attach the PDF.
- **Recent**: reopens anything you've downloaded or sent before.
- **Document settings**: signer, title, currency, payment details for invoices, and the signature on/off. These are saved in this browser.

Browsers don't let a website attach files to WhatsApp Web or a `mailto:` email. That's why on desktop the PDF is downloaded for you to attach.

## Privacy

Everything runs in the browser. Guest details are not sent to any server. Recent documents and drafts are kept in this browser's local storage only.

## Files

- `index.html`, `styles.css`, `app.js`: the interface
- `pdf.js`: PDF layouts (confirmation + invoice)
- `assets/`: logo, signature (transparent PNG) and icon
- `fonts/`: Montserrat (Latin subset, OFL licence)
- `vendor/`: jsPDF 2.5.2 and jspdf-autotable 3.8.4

To change the house rules, address or contact lines, edit the constants at the top of `pdf.js`.
