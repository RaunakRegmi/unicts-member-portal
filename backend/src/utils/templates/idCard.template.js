// HTML/CSS template for the member ID card, rendered to PDF at exact CR80
// card size (85.6mm x 54mm) — page 1 is the front face, page 2 the back.

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function idCardTemplate({
  orgName,
  orgLogoDataUrl,
  memberName,
  category,
  cardNumber,
  photoDataUrl,
  bloodGroup,
  addressLine,
  issuedAt,
  expiresAt,
  qrDataUrl,
  memberSignatureDataUrl,
  presidentSignatureDataUrl,
  presidentName,
}) {
  const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-GB') : '—');
  const categoryLabel = category === 'INSTITUTIONAL' ? 'Institutional Member' : 'General Member';

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: 85.6mm 54mm; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #14213d; }
  .face {
    width: 85.6mm; height: 54mm; overflow: hidden; position: relative;
    background: #ffffff; page-break-after: always;
  }
  .face:last-child { page-break-after: auto; }

  .band {
    background: linear-gradient(120deg, #0f2a5c 0%, #14417b 60%, #0e7490 100%);
    color: #fff; padding: 2.4mm 3mm; display: flex; align-items: center; gap: 2mm;
  }
  .band img { width: 7mm; height: 7mm; object-fit: contain; background: #fff; border-radius: 1.2mm; padding: 0.6mm; }
  .band .org { font-size: 3.1mm; font-weight: 700; letter-spacing: 0.2mm; line-height: 1.15; }
  .band .sub { font-size: 1.9mm; font-weight: 400; opacity: 0.85; }

  .front-body { display: flex; gap: 3mm; padding: 2.6mm 3mm 0; }
  .photo {
    width: 19mm; height: 23mm; border-radius: 1.5mm; object-fit: cover;
    border: 0.5mm solid #0e7490; background: #e2e8f0;
  }
  .photo-placeholder {
    width: 19mm; height: 23mm; border-radius: 1.5mm; border: 0.5mm solid #0e7490;
    background: #e2e8f0; display: flex; align-items: center; justify-content: center;
    font-size: 2.2mm; color: #64748b; text-align: center;
  }
  .info { flex: 1; min-width: 0; }
  .name { font-size: 3.6mm; font-weight: 700; margin-bottom: 0.8mm; }
  .chip {
    display: inline-block; background: #0e7490; color: #fff; font-size: 2.1mm;
    padding: 0.6mm 1.8mm; border-radius: 2mm; font-weight: 600; margin-bottom: 1.4mm;
  }
  .kv { font-size: 2.2mm; line-height: 1.5; color: #334155; }
  .kv b { color: #0f2a5c; }

  .front-footer {
    position: absolute; bottom: 0; left: 0; right: 0; padding: 0 3mm 2mm;
    display: flex; justify-content: space-between; align-items: flex-end;
  }
  .sig { text-align: center; }
  .sig img { height: 6mm; object-fit: contain; }
  .sig .line { border-top: 0.3mm solid #94a3b8; font-size: 1.9mm; color: #475569; padding-top: 0.5mm; min-width: 20mm; }

  .back-body { padding: 2.6mm 3mm; display: flex; gap: 3mm; }
  .qr { width: 22mm; height: 22mm; }
  .back-info { flex: 1; font-size: 2.2mm; color: #334155; line-height: 1.55; }
  .back-info b { color: #0f2a5c; }
  .verify-note { font-size: 1.9mm; color: #64748b; margin-top: 1mm; }
  .back-footer {
    position: absolute; bottom: 0; left: 0; right: 0; padding: 0 3mm 2mm;
    display: flex; justify-content: space-between; align-items: flex-end;
  }
  .strip { position: absolute; bottom: 9.5mm; left: 0; right: 0; height: 1mm;
    background: linear-gradient(90deg, #0f2a5c, #0e7490); }
</style>
</head>
<body>
  <!-- FRONT -->
  <div class="face">
    <div class="band">
      ${orgLogoDataUrl ? `<img src="${orgLogoDataUrl}" alt="logo" />` : ''}
      <div>
        <div class="org">${esc(orgName)}</div>
        <div class="sub">Member Identity Card</div>
      </div>
    </div>
    <div class="front-body">
      ${
        photoDataUrl
          ? `<img class="photo" src="${photoDataUrl}" alt="photo" />`
          : '<div class="photo-placeholder">Photo</div>'
      }
      <div class="info">
        <div class="name">${esc(memberName)}</div>
        <div class="chip">${categoryLabel}</div>
        <div class="kv">
          <div><b>Member No:</b> ${esc(cardNumber)}</div>
          <div><b>Blood Group:</b> ${esc(bloodGroup || '—')}</div>
          <div><b>Valid:</b> ${fmt(issuedAt)} – ${fmt(expiresAt)}</div>
        </div>
      </div>
    </div>
    <div class="front-footer">
      <div class="sig">
        ${memberSignatureDataUrl ? `<img src="${memberSignatureDataUrl}" alt="" />` : '<div style="height:6mm"></div>'}
        <div class="line">Member's Signature</div>
      </div>
    </div>
  </div>

  <!-- BACK -->
  <div class="face">
    <div class="band">
      <div>
        <div class="org">${esc(orgName)}</div>
        <div class="sub">Scan to verify this card</div>
      </div>
    </div>
    <div class="back-body">
      <img class="qr" src="${qrDataUrl}" alt="QR" />
      <div class="back-info">
        <div><b>Address:</b> ${esc(addressLine || '—')}</div>
        <div><b>Card No:</b> ${esc(cardNumber)}</div>
        <div class="verify-note">
          This card remains the property of ${esc(orgName)}. Scan the QR code to
          confirm the holder's membership status.
        </div>
      </div>
    </div>
    <div class="strip"></div>
    <div class="back-footer">
      <div></div>
      <div class="sig">
        ${presidentSignatureDataUrl ? `<img src="${presidentSignatureDataUrl}" alt="" />` : '<div style="height:6mm"></div>'}
        <div class="line">${esc(presidentName || 'President')}, President</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

module.exports = { idCardTemplate };
