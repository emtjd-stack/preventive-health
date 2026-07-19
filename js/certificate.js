/**
 * certificate.js — Preventive Health
 * Certificados PDF, notificación al admin, navegación entre módulos.
 *
 * ──────────────────────────────────────────────────────────────────
 * CONFIGURACIÓN EMAILJS (para recibir emails de finalización y contacto)
 * 1. Ve a https://www.emailjs.com/ y crea una cuenta gratuita.
 * 2. Conecta tu Gmail como servicio ("Email Services" → Add New Service).
 * 3. Crea una plantilla para finalización ("Email Templates" → Create New Template):
 *    Subject: 🎓 Nuevo aprobado: {{student_name}} — {{course_name}}
 *    Body: El estudiante {{student_name}} ({{student_email}}) aprobó {{course_name}}
 *          Calificación: {{score}} · Fecha: {{date}}
 * 4. Crea otra plantilla para el formulario de contacto:
 *    Subject: Mensaje desde la web: {{from_name}}
 *    Body: De: {{from_name}} ({{from_email}}) — Tel: {{phone}}\n{{message}}
 * 5. Rellena los 4 valores de abajo con tus datos de EmailJS.
 * ──────────────────────────────────────────────────────────────────
 */

const EMAILJS_CONFIG = {
  publicKey:           'TU_PUBLIC_KEY',       // Dashboard → Account → Public Key
  serviceId:           'TU_SERVICE_ID',       // Email Services → tu servicio
  completionTemplateId:'TU_COMPLETION_TEMPLATE', // plantilla de aprobación
  contactTemplateId:   'TU_CONTACT_TEMPLATE',    // plantilla de contacto
};

const ADMIN_EMAIL = 'emtjdbenavides@gmail.com';

const COURSE_NAMES = {
  pab:       'Brigadas de Primeros Auxilios',
  brigadas:  'Brigadas contra Incendios',
  emergencia:'Brigadas de Emergencia',
  ecg:       'Electrocardiografía Básica',
  drones:    'Pilotaje Profesional de Drones',
};

/* ═══════════════════════════════════════════════════════════════════
   1. EMAILJS — notificación al admin
═══════════════════════════════════════════════════════════════════ */

function loadEmailJS() {
  if (window.emailjs) return Promise.resolve();
  return new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
    s.onload = () => {
      if (EMAILJS_CONFIG.publicKey !== 'TU_PUBLIC_KEY') {
        window.emailjs.init({ publicKey: EMAILJS_CONFIG.publicKey });
      }
      resolve();
    };
    document.head.appendChild(s);
  });
}

async function notifyAdminCompletion(studentEmail, courseSlug, score, total) {
  if (EMAILJS_CONFIG.publicKey === 'TU_PUBLIC_KEY') return; // sin configurar
  try {
    await loadEmailJS();
    await window.emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.completionTemplateId, {
      student_name:  studentEmail,
      student_email: studentEmail,
      course_name:   COURSE_NAMES[courseSlug] || courseSlug,
      score:         `${score}/${total} (${Math.round(score/total*100)}%)`,
      date:          new Date().toLocaleDateString('es-EC', { day:'numeric', month:'long', year:'numeric' }),
      to_email:      ADMIN_EMAIL,
    });
  } catch(e) { console.warn('EmailJS no configurado o error al enviar:', e); }
}

window.sendContactForm = async function(params) {
  if (EMAILJS_CONFIG.publicKey === 'TU_PUBLIC_KEY') return false;
  try {
    await loadEmailJS();
    await window.emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.contactTemplateId, {
      ...params,
      to_email: ADMIN_EMAIL,
    });
    return true;
  } catch(e) { console.warn('Error al enviar formulario:', e); return false; }
};

/* ═══════════════════════════════════════════════════════════════════
   2. MODAL DE DATOS + GENERADOR PDF (jsPDF)
═══════════════════════════════════════════════════════════════════ */

function injectCertStyles() {
  if (document.getElementById('cert-styles')) return;
  const s = document.createElement('style');
  s.id = 'cert-styles';
  s.textContent = `
    .cert-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px}
    .cert-box{background:#fff;border-radius:16px;padding:32px;max-width:480px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.4);font-family:'Montserrat',sans-serif}
    .cert-box h2{font-size:1.25rem;font-weight:800;color:#1A509E;margin-bottom:6px}
    .cert-box p{font-size:.88rem;color:#555;margin-bottom:20px;line-height:1.5}
    .cert-field{margin-bottom:14px}
    .cert-field label{display:block;font-size:.8rem;font-weight:700;color:#1a2840;margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em}
    .cert-field input{width:100%;padding:10px 14px;border:1.5px solid #c5d9f5;border-radius:8px;font-size:.92rem;font-family:inherit;outline:none;transition:.2s;box-sizing:border-box}
    .cert-field input:focus{border-color:#1A509E}
    .cert-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .cert-actions{display:flex;gap:10px;margin-top:20px}
    .cert-btn-primary{flex:1;background:#1A509E;color:#fff;border:none;border-radius:8px;padding:12px;font-size:.92rem;font-weight:700;cursor:pointer;transition:.2s;font-family:inherit}
    .cert-btn-primary:hover{background:#163d7a}
    .cert-btn-secondary{background:#f1f3f5;color:#555;border:none;border-radius:8px;padding:12px 18px;font-size:.88rem;cursor:pointer;font-family:inherit}
    .cert-btn-secondary:hover{background:#e2e8f0}
  `;
  document.head.appendChild(s);
}

function loadJsPDF() {
  if (window.jspdf) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function getCourseSlug() {
  const m = window.location.pathname.match(/\/cursos\/([^\/]+)/);
  return m ? m[1] : 'pab';
}

window.showCertificateModal = function(score, total) {
  injectCertStyles();
  const slug = getCourseSlug();
  const courseName = COURSE_NAMES[slug] || slug;

  const overlay = document.createElement('div');
  overlay.className = 'cert-overlay';
  overlay.innerHTML = `
    <div class="cert-box">
      <h2>📜 Certificado de Aprobación</h2>
      <p>¡Felicidades! Ingresa tus datos para generar tu certificado personalizado.</p>
      <div class="cert-row">
        <div class="cert-field">
          <label>Apellidos *</label>
          <input id="c-apellidos" type="text" placeholder="Torres Ruiz" autocomplete="family-name">
        </div>
        <div class="cert-field">
          <label>Nombres *</label>
          <input id="c-nombres" type="text" placeholder="Ana María" autocomplete="given-name">
        </div>
      </div>
      <div class="cert-row">
        <div class="cert-field">
          <label>Cédula *</label>
          <input id="c-cedula" type="text" placeholder="1234567890" maxlength="13">
        </div>
        <div class="cert-field">
          <label>Ciudad *</label>
          <input id="c-ciudad" type="text" placeholder="Quito">
        </div>
      </div>
      <div class="cert-actions">
        <button class="cert-btn-secondary" onclick="this.closest('.cert-overlay').remove()">Cancelar</button>
        <button class="cert-btn-primary" onclick="window._generateCertPDF(${score},${total},'${slug}')">⬇ Descargar PDF</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('c-apellidos').focus();
};

window._generateCertPDF = async function(score, total, slug) {
  const apellidos = document.getElementById('c-apellidos').value.trim();
  const nombres   = document.getElementById('c-nombres').value.trim();
  const cedula    = document.getElementById('c-cedula').value.trim();
  const ciudad    = document.getElementById('c-ciudad').value.trim();

  if (!apellidos || !nombres || !cedula || !ciudad) {
    alert('Por favor completa todos los campos.');
    return;
  }

  const btn = document.querySelector('.cert-btn-primary');
  btn.textContent = 'Generando PDF…';
  btn.disabled = true;

  try {
    await loadJsPDF();
  } catch(e) {
    alert('Error al cargar la librería PDF. Verifica tu conexión a internet.');
    btn.textContent = '⬇ Descargar PDF';
    btn.disabled = false;
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = 297, H = 210;
  const pct = Math.round(score / total * 100);
  const fecha = new Date().toLocaleDateString('es-EC', { day:'numeric', month:'long', year:'numeric' });
  const courseName = COURSE_NAMES[slug] || slug;

  // Fondo azul oscuro
  doc.setFillColor(10, 30, 58);
  doc.rect(0, 0, W, H, 'F');

  // Fondo dorado lateral izquierdo
  doc.setFillColor(245, 179, 0);
  doc.rect(0, 0, 18, H, 'F');

  // Borde dorado exterior
  doc.setDrawColor(245, 179, 0);
  doc.setLineWidth(2);
  doc.rect(22, 8, W - 30, H - 16, 'S');

  // Borde dorado interior
  doc.setLineWidth(0.5);
  doc.rect(25, 11, W - 36, H - 22, 'S');

  // Texto vertical en la banda dorada (rotado)
  doc.setTextColor(10, 30, 58);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('PREVENTIVE HEALTH', 9, H - 12, { angle: 90 });

  // Encabezado
  doc.setTextColor(245, 179, 0);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('PREVENTIVE HEALTH — SALUD, SEGURIDAD Y MEDIO AMBIENTE', W / 2 + 4, 22, { align: 'center' });

  // Título principal
  doc.setFontSize(26);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('CERTIFICADO DE APROBACIÓN', W / 2 + 4, 38, { align: 'center' });

  // Línea decorativa dorada
  doc.setDrawColor(245, 179, 0);
  doc.setLineWidth(1.2);
  doc.line(50, 43, W - 28, 43);

  // "Certifica que:"
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 200, 230);
  doc.text('Certifica que:', W / 2 + 4, 57, { align: 'center' });

  // Nombre del estudiante
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(`${nombres.toUpperCase()} ${apellidos.toUpperCase()}`, W / 2 + 4, 72, { align: 'center' });

  // Cédula y ciudad
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(160, 185, 215);
  doc.text(`C.C. ${cedula}  ·  ${ciudad}`, W / 2 + 4, 82, { align: 'center' });

  // Texto de aprobación
  doc.setFontSize(11.5);
  doc.setTextColor(180, 200, 230);
  doc.text('ha aprobado satisfactoriamente el curso de:', W / 2 + 4, 98, { align: 'center' });

  // Nombre del curso (dorado, grande)
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(245, 179, 0);
  doc.text(courseName.toUpperCase(), W / 2 + 4, 113, { align: 'center' });

  // Línea separadora
  doc.setDrawColor(245, 179, 0);
  doc.setLineWidth(0.4);
  doc.line(70, 118, W - 48, 118);

  // Calificación y fecha
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(160, 185, 215);
  doc.text(`Calificación obtenida:  ${score}/${total}  (${pct}%)`, W / 2 + 4, 128, { align: 'center' });
  doc.text(`Fecha de aprobación:  ${fecha}`, W / 2 + 4, 136, { align: 'center' });

  // Nota del certificado oficial
  doc.setFontSize(8.5);
  doc.setTextColor(120, 150, 185);
  doc.text(
    'Dentro de los próximos 5 días hábiles recibirás el certificado oficial firmado a tu correo electrónico.',
    W / 2 + 4, 152, { align: 'center' }
  );

  // Footer
  doc.setFontSize(7.5);
  doc.setTextColor(80, 110, 150);
  doc.text('preventivehealth.ec  ·  info.preventiveh@gmail.com', W / 2 + 4, 164, { align: 'center' });

  doc.save(`Certificado_${slug}_${apellidos.replace(/\s/g,'_')}.pdf`);

  document.querySelector('.cert-overlay')?.remove();

  // Notificar al admin
  const userEmail = window._user?.email || 'estudiante@desconocido';
  notifyAdminCompletion(userEmail, slug, score, total);
};

/* ═══════════════════════════════════════════════════════════════════
   3. NAVEGACIÓN ENTRE MÓDULOS (botones "Siguiente módulo →")
═══════════════════════════════════════════════════════════════════ */

function addModuleNavigation() {
  if (document.getElementById('mod-nav-styles')) return;
  const s = document.createElement('style');
  s.id = 'mod-nav-styles';
  s.textContent = `
    .mod-nav{display:flex;justify-content:space-between;align-items:center;margin-top:24px;padding-top:18px;border-top:1px solid rgba(0,0,0,.1);flex-wrap:wrap;gap:8px}
    .mod-nav-btn{display:inline-flex;align-items:center;gap:6px;background:#1A509E;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:.85rem;font-weight:700;transition:.2s;font-family:'Montserrat',sans-serif}
    .mod-nav-btn:hover{background:#163d7a;transform:translateX(2px)}
    .mod-nav-btn.prev{background:transparent;color:#1A509E;border:1.5px solid #1A509E}
    .mod-nav-btn.prev:hover{background:#eef3fd;transform:translateX(-2px)}
    .mod-nav-spacer{flex:1}
  `;
  document.head.appendChild(s);

  const cards = [...document.querySelectorAll('[id^="m"]')];
  const finalSection = document.getElementById('final') || document.getElementById('final-quiz');

  cards.forEach((card, i) => {
    const body = card.querySelector('.mod-body') || card;
    const nav = document.createElement('div');
    nav.className = 'mod-nav';

    const prev = i > 0 ? cards[i - 1] : null;
    const next = cards[i + 1] || finalSection;

    if (prev) {
      const a = document.createElement('a');
      a.href = '#' + prev.id;
      a.className = 'mod-nav-btn prev';
      a.innerHTML = '← Módulo anterior';
      nav.appendChild(a);
    } else {
      nav.appendChild(document.createElement('span'));
    }

    if (next) {
      const label = next.id === 'final' || next.id === 'final-quiz'
        ? 'Ir a Evaluación Final →'
        : `Siguiente módulo →`;
      const a = document.createElement('a');
      a.href = '#' + next.id;
      a.className = 'mod-nav-btn';
      a.innerHTML = label;
      nav.appendChild(a);
    }

    body.appendChild(nav);
  });
}

document.addEventListener('DOMContentLoaded', addModuleNavigation);
