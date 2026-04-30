SHELL := /bin/bash

# ── Terminal colors ────────────────────────────────────────────────────────
RED    := \033[0;31m
GREEN  := \033[0;32m
YELLOW := \033[0;33m
BLUE   := \033[0;34m
CYAN   := \033[0;36m
BOLD   := \033[1m
RESET  := \033[0m

# ── SonarQube ─────────────────────────────────────────────────────────────
SONAR_HOST  ?= http://host.docker.internal:9000
SONAR_TOKEN ?= admin

# ── DAST ──────────────────────────────────────────────────────────────────
API_URL     ?= http://localhost:4000
ZAP_API_URL ?= http://host.docker.internal:4000

.PHONY: sast sast-api sast-web sast-sonar sast-install \
        sonar sonar-start sonar-stop sonar-scan sonar-scan-api sonar-scan-web \
        dast dast-scan dast-zap \
        help

# ── Default ─────────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo -e "$(BOLD)Targets DAST disponibles$(RESET)"
	@echo "────────────────────────────────────────────────"
	@echo -e "  $(CYAN)make dast$(RESET)          DAST completo (pruebas dirigidas + OWASP ZAP)"
	@echo -e "  $(CYAN)make dast-scan$(RESET)     Pruebas dirigidas Python (auth, JWT, RBAC, RCE)"
	@echo -e "  $(CYAN)make dast-zap$(RESET)      OWASP ZAP baseline scan (Docker)"
	@echo ""
	@echo -e "  Variables: API_URL=<url>  (default: $(API_URL))"
	@echo ""
	@echo -e "$(BOLD)Targets SAST disponibles$(RESET)"
	@echo "────────────────────────────────────────────────"
	@echo -e "  $(CYAN)make sast$(RESET)          Ejecuta SAST completo (API + Web)"
	@echo -e "  $(CYAN)make sast-api$(RESET)      SAST solo en la API"
	@echo -e "  $(CYAN)make sast-web$(RESET)      SAST solo en el Web"
	@echo -e "  $(CYAN)make sast-install$(RESET)  Instala dependencias SAST"
	@echo ""
	@echo -e "$(BOLD)Targets SonarQube Community$(RESET)"
	@echo "────────────────────────────────────────────────"
	@echo -e "  $(CYAN)make sonar$(RESET)              Inicia SonarQube y analiza API + Web"
	@echo -e "  $(CYAN)make sonar-start$(RESET)        Levanta el servidor SonarQube (~90s)"
	@echo -e "  $(CYAN)make sonar-scan$(RESET)         Analiza API + Web (proyectos separados)"
	@echo -e "  $(CYAN)make sonar-scan-api$(RESET)     Analiza solo la API"
	@echo -e "  $(CYAN)make sonar-scan-web$(RESET)     Analiza solo el Web"
	@echo -e "  $(CYAN)make sonar-stop$(RESET)         Detiene SonarQube (datos persisten)"
	@echo ""
	@echo -e "  Variables: SONAR_TOKEN=<token>  SONAR_HOST=<url>"
	@echo ""
	@echo -e "$(BOLD)Checks ejecutados por SAST$(RESET)"
	@echo "────────────────────────────────────────────────"
	@echo "  1. ESLint (eslint-plugin-security)  — análisis estático de código"
	@echo "     Detecta: eval, regex inseguros, inyección de objetos,"
	@echo "     timing attacks, child_process, buffers inseguros, etc."
	@echo "  2. npm audit                         — vulnerabilidades en dependencias"
	@echo ""

# ── Install SAST deps ────────────────────────────────────────────────────────
sast-install:
	@echo -e "\n$(CYAN)Instalando dependencias SAST...$(RESET)"
	@cd api && npm install --save-dev \
		eslint@^9.0.0 \
		eslint-plugin-security@^3.0.0
	@cd web && npm install --save-dev \
		eslint@^9.0.0 \
		eslint-plugin-security@^3.0.0 \
		eslint-plugin-react@^7.34.0
	@echo -e "$(GREEN)✓ Dependencias instaladas$(RESET)\n"

# ── SAST completo ────────────────────────────────────────────────────────────
sast: sast-api sast-web sast-sonar
	@echo ""
	@echo -e "$(GREEN)$(BOLD)════════════════════════════════════════$(RESET)"
	@echo -e "$(GREEN)$(BOLD)  SAST completado                        $(RESET)"
	@echo -e "$(GREEN)$(BOLD)════════════════════════════════════════$(RESET)"
	@echo ""

# ── SAST API ─────────────────────────────────────────────────────────────────
sast-api:
	@echo ""
	@echo -e "$(BLUE)$(BOLD)════════════════════════════════════════$(RESET)"
	@echo -e "$(BLUE)$(BOLD)  SAST — API (Node.js / Express)         $(RESET)"
	@echo -e "$(BLUE)$(BOLD)════════════════════════════════════════$(RESET)"

	@echo -e "\n$(CYAN)[ 1/2 ] ESLint — Análisis estático de seguridad$(RESET)"
	@echo -e "$(YELLOW)        Reglas: security/*, no-eval, no-implied-eval, no-new-func$(RESET)\n"
	@cd api && npx eslint src/ --format=stylish; \
		STATUS=$$?; \
		if [ $$STATUS -eq 0 ]; then \
			echo -e "\n$(GREEN)  ✓ Sin hallazgos de ESLint$(RESET)"; \
		else \
			echo -e "\n$(RED)  ✗ ESLint encontró problemas (ver arriba)$(RESET)"; \
		fi; \
		exit 0

	@echo -e "\n$(CYAN)[ 2/2 ] npm audit — Vulnerabilidades en dependencias$(RESET)\n"
	@cd api && npm audit --audit-level=moderate; \
		STATUS=$$?; \
		if [ $$STATUS -eq 0 ]; then \
			echo -e "\n$(GREEN)  ✓ Sin vulnerabilidades moderate/high/critical$(RESET)"; \
		else \
			echo -e "\n$(RED)  ✗ Se encontraron vulnerabilidades$(RESET)"; \
		fi; \
		exit 0

	@echo -e "\n$(GREEN)✓ SAST API finalizado$(RESET)\n"

# ── SAST Web ─────────────────────────────────────────────────────────────────
sast-web:
	@echo ""
	@echo -e "$(BLUE)$(BOLD)════════════════════════════════════════$(RESET)"
	@echo -e "$(BLUE)$(BOLD)  SAST — Web (React / Vite)              $(RESET)"
	@echo -e "$(BLUE)$(BOLD)════════════════════════════════════════$(RESET)"

	@echo -e "\n$(CYAN)[ 1/2 ] ESLint — Análisis estático de seguridad$(RESET)"
	@echo -e "$(YELLOW)        Reglas: security/*, react/no-danger, no-eval, no-script-url$(RESET)\n"
	@cd web && npx eslint src/ --format=stylish; \
		STATUS=$$?; \
		if [ $$STATUS -eq 0 ]; then \
			echo -e "\n$(GREEN)  ✓ Sin hallazgos de ESLint$(RESET)"; \
		else \
			echo -e "\n$(RED)  ✗ ESLint encontró problemas (ver arriba)$(RESET)"; \
		fi; \
		exit 0

	@echo -e "\n$(CYAN)[ 2/2 ] npm audit — Vulnerabilidades en dependencias$(RESET)\n"
	@cd web && npm audit --audit-level=moderate; \
		STATUS=$$?; \
		if [ $$STATUS -eq 0 ]; then \
			echo -e "\n$(GREEN)  ✓ Sin vulnerabilidades moderate/high/critical$(RESET)"; \
		else \
			echo -e "\n$(RED)  ✗ Se encontraron vulnerabilidades$(RESET)"; \
		fi; \
		exit 0

	@echo -e "\n$(GREEN)✓ SAST Web finalizado$(RESET)\n"

# ── SAST SonarQube (API + Web separados) ─────────────────────────────────────
sast-sonar:
	@echo ""
	@echo -e "$(BLUE)$(BOLD)════════════════════════════════════════$(RESET)"
	@echo -e "$(BLUE)$(BOLD)  SAST — SonarQube                       $(RESET)"
	@echo -e "$(BLUE)$(BOLD)════════════════════════════════════════$(RESET)"
	@if docker compose ps sonarqube 2>/dev/null | grep -q "Up"; then \
		echo -e "\n$(CYAN)[ 1/2 ] SonarQube — API (Node.js / Express)$(RESET)"; \
		echo -e "$(YELLOW)        Proyecto: security-demo-api  |  Fuentes: api/src$(RESET)\n"; \
		$(MAKE) sonar-scan-api; \
		echo -e "\n$(CYAN)[ 2/2 ] SonarQube — Web (React / Vite)$(RESET)"; \
		echo -e "$(YELLOW)        Proyecto: security-demo-web  |  Fuentes: web/src$(RESET)\n"; \
		$(MAKE) sonar-scan-web; \
	else \
		echo -e "$(YELLOW)  ⚠ SonarQube no está corriendo — omitiendo análisis Sonar$(RESET)"; \
		echo -e "$(YELLOW)    Levantalo con 'make sonar-start' y volvé a ejecutar 'make sast'$(RESET)\n"; \
	fi

# ── SonarQube ─────────────────────────────────────────────────────────────────

sonar: sonar-start sonar-scan  ## Inicia SonarQube y analiza API + Web

sonar-start:  ## Levanta el servidor SonarQube Community (Docker)
	@echo ""
	@echo -e "$(BLUE)$(BOLD)════════════════════════════════════════$(RESET)"
	@echo -e "$(BLUE)$(BOLD)  SonarQube Community                    $(RESET)"
	@echo -e "$(BLUE)$(BOLD)════════════════════════════════════════$(RESET)"
	@echo -e "\n$(CYAN)Iniciando SonarQube Community...$(RESET)"
	@docker compose up -d --wait sonarqube
	@echo -e "$(GREEN)✓ SonarQube listo → http://localhost:9000$(RESET)"
	@echo -e "$(YELLOW)  Credenciales por defecto: admin / admin$(RESET)\n"

sonar-stop:  ## Detiene SonarQube (los datos persisten en volúmenes Docker)
	@echo -e "\n$(CYAN)Deteniendo SonarQube...$(RESET)"
	@docker compose stop sonarqube
	@echo -e "$(GREEN)✓ SonarQube detenido (datos persistidos)$(RESET)\n"

sonar-scan: sonar-scan-api sonar-scan-web  ## Analiza API y Web como proyectos separados

sonar-scan-api:  ## Analiza solo la API (proyecto: security-demo-api)
	@echo -e "\n$(CYAN)Ejecutando análisis SonarQube — API...$(RESET)"
	@echo -e "$(YELLOW)  Host:  $(SONAR_HOST)$(RESET)"
	@echo -e "$(YELLOW)  Token: $(SONAR_TOKEN)$(RESET)\n"
	@docker run --rm \
		-v "$(CURDIR):/usr/src" \
		-e SONAR_HOST_URL="$(SONAR_HOST)" \
		-e SONAR_TOKEN="$(SONAR_TOKEN)" \
		sonarsource/sonar-scanner-cli \
		-Dsonar.projectBaseDir=/usr/src \
		-Dsonar.projectKey=security-demo-api \
		-Dsonar.projectName="Security Demo – API" \
		-Dsonar.sources=api/src
	@echo -e "$(GREEN)✓ API analizada → http://localhost:9000/dashboard?id=security-demo-api$(RESET)\n"

sonar-scan-web:  ## Analiza solo el Web (proyecto: security-demo-web)
	@echo -e "\n$(CYAN)Ejecutando análisis SonarQube — Web...$(RESET)"
	@echo -e "$(YELLOW)  Host:  $(SONAR_HOST)$(RESET)"
	@echo -e "$(YELLOW)  Token: $(SONAR_TOKEN)$(RESET)\n"
	@docker run --rm \
		-v "$(CURDIR):/usr/src" \
		-e SONAR_HOST_URL="$(SONAR_HOST)" \
		-e SONAR_TOKEN="$(SONAR_TOKEN)" \
		sonarsource/sonar-scanner-cli \
		-Dsonar.projectBaseDir=/usr/src \
		-Dsonar.projectKey=security-demo-web \
		-Dsonar.projectName="Security Demo – Web" \
		-Dsonar.sources=web/src
	@echo -e "$(GREEN)✓ Web analizado → http://localhost:9000/dashboard?id=security-demo-web$(RESET)\n"

# ── DAST ──────────────────────────────────────────────────────────────────────

dast: dast-scan dast-zap  ## DAST completo: pruebas dirigidas + OWASP ZAP
	@echo ""
	@echo -e "$(GREEN)$(BOLD)════════════════════════════════════════$(RESET)"
	@echo -e "$(GREEN)$(BOLD)  DAST completado                        $(RESET)"
	@echo -e "$(GREEN)$(BOLD)════════════════════════════════════════$(RESET)"
	@echo ""

dast-scan:  ## Pruebas DAST dirigidas: autenticación, JWT, RBAC, RCE, SQLi
	@echo ""
	@echo -e "$(BLUE)$(BOLD)════════════════════════════════════════$(RESET)"
	@echo -e "$(BLUE)$(BOLD)  DAST — Pruebas dirigidas (Python)      $(RESET)"
	@echo -e "$(BLUE)$(BOLD)════════════════════════════════════════$(RESET)"
	@echo -e "$(YELLOW)  Target: $(API_URL)$(RESET)\n"
	@python3 dast/dast.py --url $(API_URL); exit 0

dast-zap:  ## OWASP ZAP baseline scan via docker compose (perfil "dast")
	@echo ""
	@echo -e "$(BLUE)$(BOLD)════════════════════════════════════════$(RESET)"
	@echo -e "$(BLUE)$(BOLD)  DAST — OWASP ZAP Baseline Scan         $(RESET)"
	@echo -e "$(BLUE)$(BOLD)════════════════════════════════════════$(RESET)"
	@echo -e "$(YELLOW)  Target: http://api:4000 (red Docker interna)$(RESET)"
	@echo -e "$(YELLOW)  Reporte: dast/reports/zap-report.html$(RESET)\n"
	@mkdir -p dast/reports
	@docker compose --profile dast run --rm zap
	@echo -e "$(GREEN)✓ Reporte ZAP → dast/reports/zap-report.html$(RESET)\n"
