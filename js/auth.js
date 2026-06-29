/**
 * auth.js — Preventive Health · Guard de autenticación Supabase
 *
 * ⚠️  CONFIGURACIÓN: reemplaza las 2 líneas de abajo con los valores
 *     de tu proyecto Supabase:
 *     supabase.com → tu proyecto → Settings → API
 */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL  = 'SUPABASE_URL_AQUI';    // ← pega tu Project URL
const SUPABASE_ANON = 'SUPABASE_ANON_KEY_AQUI'; // ← pega tu anon public key

const sb = createClient(SUPABASE_URL, SUPABASE_ANON);
const { data: { session } } = await sb.auth.getSession();

/** Calcula la raíz del sitio sin importar la profundidad de la URL */
function siteBase() {
  const h = window.location.href;
  const markers = ['/cursos/', '/herramientas/', '/login/', '/admin/'];
  for (const m of markers) {
    const idx = h.indexOf(m);
    if (idx !== -1) return h.slice(0, idx);
  }
  return window.location.origin;
}

if (!session) {
  const base = siteBase();
  window.location.replace(base + '/login/?r=' + encodeURIComponent(window.location.href));
} else {
  document.documentElement.style.visibility = 'visible';

  // Exponer cliente e info del usuario para uso en la página
  window._sb   = sb;
  window._user = session.user;

  // Inyectar botón de cierre de sesión en el nav
  const style = document.createElement('style');
  style.textContent = `
    .nav-user { display:flex; align-items:center; gap:10px; margin-left:auto }
    .nav-user-name { color:rgba(255,255,255,.8); font-size:.82rem; }
    .nav-logout { background:rgba(255,255,255,.15); color:#fff; border:1px solid rgba(255,255,255,.35);
      padding:5px 13px; border-radius:6px; cursor:pointer; font-size:.82rem; font-family:inherit;
      transition:background .2s; }
    .nav-logout:hover { background:rgba(255,255,255,.25); }
  `;
  document.head.appendChild(style);

  const nav = document.querySelector('nav');
  if (nav) {
    const wrap = document.createElement('div');
    wrap.className = 'nav-user';
    const name = session.user.email.split('@')[0];
    wrap.innerHTML = `<span class="nav-user-name">👤 ${name}</span>
      <button class="nav-logout" id="btnLogout">Salir</button>`;
    nav.appendChild(wrap);
    document.getElementById('btnLogout').onclick = async () => {
      await sb.auth.signOut();
      window.location.replace(siteBase() + '/login/');
    };
  }
}
