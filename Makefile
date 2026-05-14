BACKEND_DIR := backend
FRONTEND_DIR := frontend
BACKEND_VENV := $(BACKEND_DIR)/.venv
BACKEND_PYTHON := $(BACKEND_VENV)/bin/python
BACKEND_PIP := $(BACKEND_VENV)/bin/pip

.PHONY: lint test lint-backend lint-frontend test-backend test-frontend backend-venv

backend-venv: $(BACKEND_VENV)/bin/python

$(BACKEND_VENV)/bin/python: $(BACKEND_DIR)/requirements.txt
	python3 -m venv $(BACKEND_VENV)
	$(BACKEND_PIP) install -q -r $(BACKEND_DIR)/requirements.txt

lint: lint-backend lint-frontend

lint-backend: backend-venv
	cd $(BACKEND_DIR) && ../$(BACKEND_VENV)/bin/ruff check .
	cd $(BACKEND_DIR) && ../$(BACKEND_VENV)/bin/mypy app --strict
	cd $(BACKEND_DIR) && ../$(BACKEND_VENV)/bin/radon cc app -n C

lint-frontend:
	cd $(FRONTEND_DIR) && npx tsc --noEmit
	cd $(FRONTEND_DIR) && npx eslint src

test: test-backend test-frontend

test-backend: backend-venv
	cd $(BACKEND_DIR) && ../$(BACKEND_VENV)/bin/pytest --cov=app --cov-fail-under=80

test-frontend:
	cd $(FRONTEND_DIR) && CI=true npm run test -- --coverage
