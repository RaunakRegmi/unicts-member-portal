// HTML/CSS template for generated CVs (A4), shared by every CvTemplate row —
// the row's templateSchema tweaks accent color and section order.

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function list(items, render) {
  return (items || []).map(render).join('');
}

// Inline SVG contact icons (lucide path data) — emoji glyphs render
// inconsistently across PDF engines, stroked vectors do not.
const ICON_PATHS = {
  phone:
    '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  mapPin:
    '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  link:
    '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
};

function cvTemplate({ data, schema = {} }) {
  const accent = schema.accentColor || '#0e7490';
  const isInstitutional = data.category === 'INSTITUTIONAL';

  const icon = (name) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:9pt;height:9pt;vertical-align:-1.5pt;margin-right:3pt">${ICON_PATHS[name]}</svg>`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4; margin: 14mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1e293b; font-size: 10.5pt; line-height: 1.5; }
  header { border-bottom: 3px solid ${accent}; padding-bottom: 10px; margin-bottom: 16px; }
  h1 { font-size: 21pt; color: #0f172a; }
  .tagline { color: ${accent}; font-weight: 600; margin-top: 2px; }
  .contact { margin-top: 6px; color: #475569; font-size: 9.5pt; }
  .contact span { margin-right: 14px; }
  h2 {
    font-size: 11.5pt; text-transform: uppercase; letter-spacing: 1px;
    color: ${accent}; margin: 16px 0 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px;
  }
  .item { margin-bottom: 8px; }
  .item .head { display: flex; justify-content: space-between; font-weight: 600; }
  .item .meta { color: #64748b; font-size: 9.5pt; }
  .skills { display: flex; flex-wrap: wrap; gap: 6px; }
  .skill {
    background: ${accent}18; color: ${accent}; border: 1px solid ${accent}55;
    border-radius: 10px; padding: 2px 10px; font-size: 9pt; font-weight: 600;
  }
  footer {
    position: fixed; bottom: -8mm; left: 0; right: 0;
    font-size: 8pt; color: #94a3b8; text-align: center;
  }
</style>
</head>
<body>
  <header>
    <h1>${esc(data.fullName)}</h1>
    ${data.headline ? `<div class="tagline">${esc(data.headline)}</div>` : ''}
    <div class="contact">
      ${data.phone ? `<span>${icon('phone')}${esc(data.phone)}</span>` : ''}
      ${data.email ? `<span>${icon('mail')}${esc(data.email)}</span>` : ''}
      ${data.address ? `<span>${icon('mapPin')}${esc(data.address)}</span>` : ''}
      ${data.socialProfileUrl ? `<span>${icon('link')}${esc(data.socialProfileUrl)}</span>` : ''}
    </div>
  </header>

  ${
    data.summary
      ? `<section><h2>${isInstitutional ? 'Organization Profile' : 'Summary'}</h2><p>${esc(data.summary)}</p></section>`
      : ''
  }

  ${
    (data.skills || []).length
      ? `<section><h2>Skills</h2><div class="skills">${list(
          data.skills,
          (s) => `<span class="skill">${esc(s)}</span>`
        )}</div></section>`
      : ''
  }

  ${
    (data.experience || []).length
      ? `<section><h2>${isInstitutional ? 'Services & Track Record' : 'Experience'}</h2>${list(
          data.experience,
          (e) => `<div class="item">
            <div class="head"><span>${esc(e.title)}</span><span class="meta">${esc(e.period || '')}</span></div>
            <div class="meta">${esc(e.organization || '')}</div>
            ${e.description ? `<div>${esc(e.description)}</div>` : ''}
          </div>`
        )}</section>`
      : ''
  }

  ${
    (data.education || []).length
      ? `<section><h2>Education</h2>${list(
          data.education,
          (e) => `<div class="item">
            <div class="head"><span>${esc(e.qualification)}</span><span class="meta">${esc(e.period || '')}</span></div>
            <div class="meta">${esc([e.institution, e.fieldOfStudy].filter(Boolean).join(' · '))}</div>
          </div>`
        )}</section>`
      : ''
  }

  <footer>Generated via the ${esc(data.orgName || 'UNICTS')} Member Portal</footer>
</body>
</html>`;
}

module.exports = { cvTemplate };
