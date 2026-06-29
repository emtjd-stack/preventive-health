import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL  = 'https://lqcvdhgjdotsmivwerfa.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxY3ZkaGdqZG90c21pdndlcmZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2OTAyMzIsImV4cCI6MjA5ODI2NjIzMn0.K_zMW8KrAyLEeh2wYI9MDn2sHV0j4x0OQy5T2oF7PPg';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON);
const { data: { session } } = await sb.auth.getSession();

function siteBase() {
  const h = window.location.href;
  const markers = ['/cursos/', '/herramientas/', '/login/', '/admin/'];
  for (const m of markers) {
    const idx = h.indexOf(m);
    if (idx !== -1) return h.slice(0, idx);
  }
  return window.location.origin;
}

function getCourseSlug() {
  const match = window.location.pathname.match(/\/cursos\/([^\/]+)\//);
  return match ? match[1] : null;
}

const base = siteBase();

if (!session) {
  window.location.replace(base + '/login/?r=' + encodeURIComponent(window.location.href));
} else {
  const courseSlug = getCourseSlug();

  if (courseSlug) {
    const { data, error } = await sb
      .from('accesos')
      .select('activo')
      .eq('user_id', session.user.id)
      .eq('curso', courseSlug)
      .single();

    if (error || !data || !data.activo) {
      window.location.replace(base + '/cursos/?sin_acceso=' + courseSlug);
      throw new Error('acceso denegado');
    }
  }

  document.documentElement.style.visibility = 'visible';
  window._sb   = sb;
  window._user = session.user;

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
    const name = session.user.user_metadata?.full_name || session.user.email.split('@')[0];
    wrap.innerHTML = `<span class="nav-user-name">👤 ${name}</span>
      <button class="nav-logout" id="btnLogout">Salir</button>`;
    nav.appendChild(wrap);
    document.getElementById('btnLogout').onclick = async () => {
      await sb.auth.signOut();
      window.location.replace(base + '/login/');
    };
  }
}
