.PHONY: install api sdk playground test docker-up docker-down clean

PYTHON ?= python
PIP ?= pip

# ── Install ───────────────────────────────────────────────
install: install-api install-sdk install-playground

install-api:
	cd api && $(PIP) install -r requirements.txt

install-sdk:
	cd sdk && npm install

install-playground:
	cd playground && npm install

# ── Dev servers ───────────────────────────────────────────
api:
	cd api && uvicorn main:app --reload --port 8000

playground:
	cd playground && npm run dev

# ── Test ──────────────────────────────────────────────────
test: test-sdk

test-sdk:
	cd sdk && npm test

# ── Build ─────────────────────────────────────────────────
build-sdk:
	cd sdk && npm run build

build-playground:
	cd playground && npm run build

# ── Docker ────────────────────────────────────────────────
docker-up:
	docker compose up

docker-down:
	docker compose down

# ── Cleanup ───────────────────────────────────────────────
clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	rm -rf sdk/dist sdk/node_modules playground/dist playground/node_modules

help:
	@echo "Common targets:"
	@echo "  make install        Install all three subprojects"
	@echo "  make api            Run the FastAPI server"
	@echo "  make playground     Run the React playground"
	@echo "  make test-sdk       Run SDK Jest tests"
	@echo "  make docker-up      Run all services via docker compose"
