#!/usr/bin/env python3
"""
Preventive Health — Carga masiva de estudiantes en Supabase
Uso: python3 crear_estudiantes.py estudiantes.csv

Columnas del CSV:
  email     → correo del estudiante (obligatorio)
  nombre    → nombre completo (opcional, mejora la contraseña)
  cursos    → slugs separados por | (si está vacío no se asigna ningún curso)

Slugs disponibles:
  pab | brigadas | emergencia | ecg | drones

Ejemplo de CSV:
  email,nombre,cursos
  ana.torres@empresa.com,Ana Torres,pab|ecg
  luis.vega@empresa.com,Luis Vega,brigadas
  mario.paz@empresa.com,Mario Paz,pab|brigadas|emergencia|ecg|drones
"""

import csv
import sys
import json
import random
import string
import unicodedata
import urllib.request
import urllib.error
from datetime import datetime

SUPABASE_URL = "https://lqcvdhgjdotsmivwerfa.supabase.co"

# ⚠ Pega aquí tu service_role key (Settings → API → service_role secret)
# NUNCA compartas ni publiques esta clave
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxY3ZkaGdqZG90c21pdndlcmZhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjY5MDIzMiwiZXhwIjoyMDk4MjY2MjMyfQ.OBVImNJv5ycwH0FEliGF_xtUs0Dhk1AkUu-s3uCDj-4"

SLUGS_VALIDOS = {"pab", "brigadas", "emergencia", "ecg", "drones"}


def normalizar(texto):
    return ''.join(
        c for c in unicodedata.normalize('NFD', texto)
        if unicodedata.category(c) != 'Mn'
    ).upper()


def generar_password(nombre=""):
    """
    Nomenclatura: PH-[AAAAMM]-[3letrasApellido][2digitos]
    Ejemplo: PH-202607-TOR42
    """
    fecha = datetime.now().strftime("%Y%m")
    sufijo_num = ''.join(random.choices(string.digits, k=2))
    if nombre:
        palabras = normalizar(nombre).split()
        apellido = palabras[-1] if len(palabras) > 1 else palabras[0]
        letras = apellido[:3].ljust(3, 'X')
    else:
        letras = ''.join(random.choices(string.ascii_uppercase, k=3))
    return f"PH-{fecha}-{letras}{sufijo_num}"


def request_supabase(path, payload, service_key, method="POST"):
    url = f"{SUPABASE_URL}{path}"
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        url, data=data,
        headers={
            "Content-Type": "application/json",
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Prefer": "return=representation",
        },
        method=method
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return True, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return False, e.read().decode()


def crear_usuario(email, password, service_key):
    """Crea el usuario en Supabase Auth."""
    ok, resp = request_supabase(
        "/auth/v1/admin/users",
        {"email": email, "password": password, "email_confirm": True},
        service_key
    )
    if ok:
        return True, resp.get("id", "")
    return False, resp


def asignar_cursos(user_id, slugs, service_key):
    """Inserta filas en la tabla accesos para cada curso habilitado."""
    filas = [{"user_id": user_id, "curso": slug, "activo": True} for slug in slugs]
    ok, resp = request_supabase("/rest/v1/accesos", filas, service_key)
    return ok, resp


def main():
    if len(sys.argv) < 2:
        print("Uso: python3 crear_estudiantes.py estudiantes.csv")
        sys.exit(1)

    service_key = SERVICE_ROLE_KEY
    if not service_key:
        print("⚠  Agrega tu SERVICE_ROLE_KEY al script.")
        print("   Supabase → Settings → API → service_role (secret)")
        sys.exit(1)

    csv_path = sys.argv[1]

    # Leer el archivo completo y detectar separador + saltar líneas no-datos al inicio
    with open(csv_path, newline='', encoding='utf-8-sig') as f:
        texto = f.read()

    lineas = texto.splitlines()

    # Encontrar la primera línea que contiene "email" (la cabecera real)
    inicio = 0
    for i, linea in enumerate(lineas):
        if 'email' in linea.lower():
            inicio = i
            break

    texto_limpio = '\n'.join(lineas[inicio:])

    # Auto-detectar separador (coma o punto y coma)
    muestra = texto_limpio[:500]
    separador = ';' if muestra.count(';') > muestra.count(',') else ','

    import io
    reader = csv.DictReader(io.StringIO(texto_limpio), delimiter=separador)
    filas = list(reader)

    print(f"\n{'='*60}")
    print(f"  Preventive Health — Creando {len(filas)} estudiante(s)")
    print(f"{'='*60}\n")

    resultados = []

    # Normalizar nombres de columna a minúsculas para evitar problemas con Excel
    filas = [{k.lower().strip(): v for k, v in f.items() if k} for f in filas]

    for fila in filas:
        email      = fila.get('email', '').strip()
        nombre     = fila.get('nombre', '').strip()
        cursos_raw = fila.get('cursos', '').strip()

        if not email:
            continue

        # Validar y filtrar slugs
        slugs = []
        if cursos_raw:
            for s in cursos_raw.split('|'):
                s = s.strip().lower()
                if s in SLUGS_VALIDOS:
                    slugs.append(s)
                else:
                    print(f"  ⚠ Slug desconocido ignorado: '{s}' ({email})")

        password = generar_password(nombre)
        ok_user, info = crear_usuario(email, password, service_key)

        if ok_user:
            user_id = info
            print(f"✓ CREADO   {email}")
            print(f"           Contraseña : {password}")

            if slugs:
                ok_acc, _ = asignar_cursos(user_id, slugs, service_key)
                if ok_acc:
                    print(f"           Cursos     : {', '.join(slugs)}")
                else:
                    print(f"           ⚠ Cursos no asignados (revisa permisos de tabla accesos)")
            else:
                print(f"           Cursos     : (ninguno asignado aún)")
        else:
            if "already registered" in info or "already been registered" in info:
                print(f"⚠ EXISTE   {email}  (ya tiene cuenta — cursos no modificados)")
            else:
                print(f"✗ ERROR    {email}  →  {info[:100]}")

        resultados.append({
            "email": email,
            "nombre": nombre,
            "password": password if ok_user else "",
            "cursos": ', '.join(slugs),
            "estado": "creado" if ok_user else "error/existe",
            "detalle": "" if ok_user else info[:200]
        })

    # Guardar credenciales
    salida = csv_path.replace('.csv', '_credenciales.csv')
    with open(salida, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=["email", "nombre", "password", "cursos", "estado", "detalle"])
        writer.writeheader()
        writer.writerows(resultados)

    creados = sum(1 for r in resultados if r['estado'] == 'creado')
    print(f"\n{'='*60}")
    print(f"  Resultado: {creados}/{len(resultados)} cuentas creadas")
    print(f"  Credenciales guardadas en: {salida}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
