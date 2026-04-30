#!/usr/bin/env python3
"""
DAST (Dynamic Application Security Testing) — Security Demo API
Pruebas dinámicas de seguridad sobre la aplicación en ejecución.

Suites de prueba:
  1. Headers HTTP de Seguridad
  2. Autenticación (credenciales, SQLi, DoS potencial)
  3. Control de Sesión — JWT (tampered payload, alg:none)
  4. Control de Acceso — RBAC (viewer vs. admin)
  5. Vulnerabilidad conocida — RCE via eval()
  6. Inyección SQL

Uso:
  python3 dast/dast.py [--url http://localhost:4000]
"""

import argparse
import base64
import json
import sys
import urllib.error
import urllib.parse
import urllib.request

DEFAULT_URL = "http://localhost:4000"

RED    = "\033[0;31m"
GREEN  = "\033[0;32m"
YELLOW = "\033[0;33m"
BLUE   = "\033[0;34m"
CYAN   = "\033[0;36m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

results = {"passed": 0, "failed": 0, "warnings": 0}


# ── HTTP helper ───────────────────────────────────────────────────────────────

def http(base_url, method, path, body=None, token=None, extra_headers=None, timeout=10):
    """HTTP request → (status_code, body, response_headers)."""
    url = f"{base_url}{path}"
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if extra_headers:
        headers.update(extra_headers)

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            try:
                parsed = json.loads(raw)
            except Exception:
                parsed = raw
            return resp.status, parsed, dict(resp.headers)
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(raw)
        except Exception:
            parsed = raw
        return e.code, parsed, dict(e.headers)
    except Exception as exc:
        return 0, str(exc), {}


# ── Output helpers ────────────────────────────────────────────────────────────

def ok(name, detail=""):
    results["passed"] += 1
    suffix = f"\n         {CYAN}{detail}{RESET}" if detail else ""
    print(f"  {GREEN}✓ PASS{RESET}  {name}{suffix}")

def fail(name, detail=""):
    results["failed"] += 1
    suffix = f"\n         {RED}{detail}{RESET}" if detail else ""
    print(f"  {RED}✗ FAIL{RESET}  {name}{suffix}")

def vuln(name, detail=""):
    results["failed"] += 1
    suffix = f"\n         {RED}{detail}{RESET}" if detail else ""
    print(f"  {RED}✗ VULN{RESET}  {name}{suffix}")

def warn(name, detail=""):
    results["warnings"] += 1
    suffix = f"\n         {YELLOW}{detail}{RESET}" if detail else ""
    print(f"  {YELLOW}⚠ WARN{RESET}  {name}{suffix}")

def section(n, total, title):
    print(f"\n{CYAN}[ {n}/{total} ] {title}{RESET}")


# ── JWT helpers ───────────────────────────────────────────────────────────────

def _b64url_decode(s):
    s += "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s)

def _b64url_encode(b):
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()

def jwt_tamper_payload(token, patch):
    """Same header + tampered payload + original signature (invalid → server must reject)."""
    try:
        header_b64, payload_b64, sig = token.split(".")
        payload = json.loads(_b64url_decode(payload_b64))
        payload.update(patch)
        new_p = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode())
        return f"{header_b64}.{new_p}.{sig}"
    except Exception:
        return token

def jwt_alg_none(token):
    """Set alg=none and strip the signature — tests algorithm confusion attack."""
    try:
        header_b64, payload_b64, _ = token.split(".")
        header = json.loads(_b64url_decode(header_b64))
        header["alg"] = "none"
        new_h = _b64url_encode(json.dumps(header, separators=(",", ":")).encode())
        return f"{new_h}.{payload_b64}."
    except Exception:
        return token


# ── Test suites ───────────────────────────────────────────────────────────────

def suite_headers(base_url):
    section(1, 6, "Headers HTTP de Seguridad")
    _, _, headers = http(base_url, "GET", "/api/auth/me")

    security_headers = [
        "X-Content-Type-Options",
        "X-Frame-Options",
        "Content-Security-Policy",
        "Referrer-Policy",
    ]
    for h in security_headers:
        val = headers.get(h) or headers.get(h.lower())
        if val:
            ok(f"{h}: {val!r}")
        else:
            fail(f"{h} — header ausente")

    warn(
        "Strict-Transport-Security — omitido en HTTP local",
        "Requerido en producción (HTTPS)"
    )

    server = headers.get("Server") or headers.get("server") or ""
    if any(kw in server.lower() for kw in ("express", "node", "apache", "nginx")):
        warn(f"Server: {server!r} — revela tecnología (fingerprinting)")
    else:
        server_display = repr(server) if server else "ausente"
        ok(f"Server header no revela stack ({server_display})")


def suite_auth(base_url):
    section(2, 6, "Autenticación")

    status, body, _ = http(base_url, "POST", "/api/auth/login",
                           {"email": "admin@demo.com", "password": "Admin123!"})
    if status == 200 and isinstance(body, dict) and "token" in body:
        ok("Login válido → 200 + token JWT")
    else:
        fail(f"Login válido → {status}", str(body))

    status, body, _ = http(base_url, "POST", "/api/auth/login",
                           {"email": "admin@demo.com", "password": "contraseñaerronea"})
    if status == 401:
        ok("Credenciales incorrectas → 401")
    else:
        fail(f"Credenciales incorrectas → {status} (esperado 401)", str(body))

    status, body, _ = http(base_url, "POST", "/api/auth/login",
                           {"email": "noexiste@demo.com", "password": "x"})
    if status == 401:
        ok("Email inexistente → 401")
    else:
        fail(f"Email inexistente → {status} (esperado 401)", str(body))

    status, body, _ = http(base_url, "POST", "/api/auth/login", {})
    if status in (400, 401, 422):
        ok(f"Cuerpo vacío → {status} (manejo correcto de input)")
    else:
        fail(f"Cuerpo vacío → {status} (esperado 4xx)", str(body))

    # Password extremadamente largo — potencial DoS por bcrypt (unbounded cost)
    status, body, _ = http(base_url, "POST", "/api/auth/login",
                           {"email": "admin@demo.com", "password": "A" * 10_000},
                           timeout=30)
    if status < 500:
        ok(f"Password 10 000 chars → {status} (no crash de servidor)")
    else:
        fail(f"Password 10 000 chars → {status} (error interno)", str(body))


def suite_jwt(base_url):
    section(3, 6, "Control de Sesión — JWT")

    status, body, _ = http(base_url, "POST", "/api/auth/login",
                           {"email": "bob@demo.com", "password": "Bob123!"})
    if status != 200 or not isinstance(body, dict) or "token" not in body:
        fail("No se pudo obtener token de prueba — omitiendo suite JWT")
        return
    valid_token = body["token"]

    status, _, _ = http(base_url, "GET", "/api/auth/me")
    if status == 401:
        ok("Sin Authorization header → 401")
    else:
        fail(f"Sin token → {status} (esperado 401)")

    status, _, _ = http(base_url, "GET", "/api/auth/me", token="basura.sinvalida.aqui")
    if status == 401:
        ok("Token aleatorio (basura) → 401")
    else:
        fail(f"Token inválido → {status} (esperado 401)")

    tampered = jwt_tamper_payload(valid_token, {"email": "hacker@evil.com"})
    status, body, _ = http(base_url, "GET", "/api/auth/me", token=tampered)
    if status == 401:
        ok("JWT con payload tamperado (firma inválida) → 401")
    else:
        vuln(f"JWT tamperado → {status} ¡payload manipulado aceptado!", str(body))

    none_token = jwt_alg_none(valid_token)
    status, body, _ = http(base_url, "GET", "/api/auth/me", token=none_token)
    if status == 401:
        ok("JWT alg=none (sin firma) → 401 (algorithm confusion rechazado)")
    else:
        vuln(f"JWT alg=none → {status} ¡token sin firma aceptado!", str(body))

    status, _, _ = http(base_url, "GET", "/api/auth/me",
                        extra_headers={"Authorization": "Bearer "})
    if status == 401:
        ok("Bearer vacío → 401")
    else:
        fail(f"Bearer vacío → {status} (esperado 401)")


def suite_rbac(base_url):
    section(4, 6, "Control de Acceso — RBAC")

    status, body, _ = http(base_url, "POST", "/api/auth/login",
                           {"email": "admin@demo.com", "password": "Admin123!"})
    admin_token = body.get("token") if status == 200 and isinstance(body, dict) else None

    status, body, _ = http(base_url, "POST", "/api/auth/login",
                           {"email": "bob@demo.com", "password": "Bob123!"})
    viewer_token = body.get("token") if status == 200 and isinstance(body, dict) else None

    if not admin_token:
        fail("No se pudo autenticar admin — omitiendo suite RBAC")
        return
    if not viewer_token:
        fail("No se pudo autenticar viewer (bob) — omitiendo suite RBAC")
        return

    status, _, _ = http(base_url, "GET", "/api/users", token=admin_token)
    if status == 200:
        ok("admin: GET /api/users → 200 (permitido)")
    else:
        fail(f"admin: GET /api/users → {status} (esperado 200)")

    # viewer tiene users:read — GET /api/users debe ser permitido
    status, body, _ = http(base_url, "GET", "/api/users", token=viewer_token)
    if status == 200:
        ok("viewer: GET /api/users → 200 (users:read permitido por diseño)")
    else:
        fail(f"viewer: GET /api/users → {status} (esperado 200)", str(body))

    status, body, _ = http(base_url, "POST", "/api/roles",
                           {"name": "hacker_role"}, token=viewer_token)
    if status == 403:
        ok("viewer: POST /api/roles → 403 (denegado)")
    else:
        vuln(f"viewer: POST /api/roles → {status} ¡creación no autorizada!", str(body))

    status, body, _ = http(base_url, "DELETE", "/api/users/999", token=viewer_token)
    if status == 403:
        ok("viewer: DELETE /api/users/999 → 403 (denegado)")
    else:
        vuln(f"viewer: DELETE /api/users/999 → {status} ¡eliminación no autorizada!", str(body))

    status, body, _ = http(base_url, "POST", "/api/users",
                           {"email": "x@x.com", "password": "X"}, token=viewer_token)
    if status == 403:
        ok("viewer: POST /api/users → 403 (denegado)")
    else:
        vuln(f"viewer: POST /api/users → {status} ¡creación no autorizada!", str(body))

    status, _, _ = http(base_url, "GET", "/api/users")
    if status == 401:
        ok("Sin auth: GET /api/users → 401")
    else:
        fail(f"Sin auth: GET /api/users → {status} (esperado 401)")


def suite_rce(base_url):
    section(5, 6, "Vulnerabilidad conocida — RCE via eval()")
    print(f"  {YELLOW}Endpoint: GET /api/auth/debug/eval?expr=<código JavaScript>{RESET}")
    print(f"  {YELLOW}CWE-94: Improper Control of Code Generation{RESET}")

    expr = urllib.parse.quote("1+1")
    status, body, _ = http(base_url, "GET", f"/api/auth/debug/eval?expr={expr}")
    if status == 404:
        ok("GET /api/auth/debug/eval → 404 (endpoint no expuesto)")
        return
    if status == 200 and isinstance(body, dict) and body.get("result") == 2:
        vuln(
            "eval(1+1) → result=2  — ejecución de código JavaScript confirmada",
            f"Respuesta: {json.dumps(body)}"
        )
    else:
        warn(f"GET /api/auth/debug/eval?expr=1+1 → {status}", str(body))

    expr = urllib.parse.quote("Object.keys(process.env).length")
    status, body, _ = http(base_url, "GET", f"/api/auth/debug/eval?expr={expr}")
    if status == 200 and isinstance(body, dict) and isinstance(body.get("result"), int):
        vuln(
            f"eval(process.env) → {body['result']} variables de entorno accesibles",
            f"Respuesta: {json.dumps(body)}"
        )

    expr = urllib.parse.quote("require('fs').readdirSync('.').slice(0,5).join(',')")
    status, body, _ = http(base_url, "GET", f"/api/auth/debug/eval?expr={expr}")
    if status == 200 and isinstance(body, dict) and body.get("result"):
        vuln(
            "eval(require('fs').readdirSync('.')) → listado del sistema de archivos del servidor",
            f"Respuesta: {json.dumps(body)}"
        )


def suite_sqli(base_url):
    section(6, 6, "Inyección SQL")

    payloads = [
        ("' OR '1'='1",            "OR clásico"),
        ("' OR 1=1--",             "OR con comentario"),
        ("admin'--",               "terminación de string"),
        ("'; DROP TABLE users--",  "statement destructivo"),
        ("' UNION SELECT 1,2,3--", "UNION probe"),
    ]
    for payload, desc in payloads:
        status, body, _ = http(base_url, "POST", "/api/auth/login",
                               {"email": payload, "password": "x"})
        if status == 200 and isinstance(body, dict) and "token" in body:
            vuln(f"SQLi [{desc}] → 200 ¡BYPASS DE AUTENTICACIÓN!", str(body))
        elif status == 500:
            fail(f"SQLi [{desc}] → 500 (error interno, posible inyección parcial)", str(body))
        else:
            ok(f"SQLi [{desc}] → {status} (sin bypass)")


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="DAST — Security Demo API")
    parser.add_argument("--url", default=DEFAULT_URL,
                        help=f"URL base de la API (default: {DEFAULT_URL})")
    args = parser.parse_args()
    base_url = args.url.rstrip("/")

    print()
    print(f"{BLUE}{BOLD}════════════════════════════════════════{RESET}")
    print(f"{BLUE}{BOLD}  DAST — API ({base_url}){RESET}")
    print(f"{BLUE}{BOLD}════════════════════════════════════════{RESET}")

    # Connectivity check
    status, _, _ = http(base_url, "GET", "/api/auth/me", timeout=5)
    if status == 0:
        print(f"\n{RED}ERROR: No se pudo conectar a {base_url}{RESET}")
        print(f"{YELLOW}       Levantá la API: docker compose up -d api{RESET}\n")
        sys.exit(1)

    suite_headers(base_url)
    suite_auth(base_url)
    suite_jwt(base_url)
    suite_rbac(base_url)
    suite_rce(base_url)
    suite_sqli(base_url)

    total = results["passed"] + results["failed"] + results["warnings"]
    print()
    print(f"{BOLD}════════════════════════════════════════{RESET}")
    print(f"{BOLD}  Resumen DAST — {total} verificaciones{RESET}")
    print(f"{BOLD}════════════════════════════════════════{RESET}")
    print(f"  {GREEN}Pasaron:      {results['passed']}{RESET}")
    print(f"  {RED}Fallaron:     {results['failed']}{RESET}")
    print(f"  {YELLOW}Advertencias: {results['warnings']}{RESET}")
    print()

    sys.exit(1 if results["failed"] > 0 else 0)


if __name__ == "__main__":
    main()
