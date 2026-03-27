# Gelani Healthcare Assistant - Makefile
# ========================================
# Build, test, and deployment commands

.PHONY: help install dev build test test-unit test-integration test-integration-ci clean

# Default target
help:
	@echo "Gelani Healthcare Assistant - Available Commands:"
	@echo ""
	@echo "  Development:"
	@echo "    make install          Install dependencies"
	@echo "    make dev              Start development server"
	@echo "    make build            Build for production"
	@echo ""
	@echo "  Testing:"
	@echo "    make test             Run all tests"
	@echo "    make test-unit        Run unit tests only"
	@echo "    make test-integration Run integration tests"
	@echo "    make test-integration-ci Run integration tests with CI output"
	@echo ""
	@echo "  Services:"
	@echo "    make services-start   Start all mini-services"
	@echo "    make services-stop    Stop all mini-services"
	@echo ""
	@echo "  Utilities:"
	@echo "    make clean            Clean build artifacts"
	@echo "    make lint             Run linters"
	@echo "    make format           Format code"

# Install dependencies
install:
	bun install
	cd mini-services/medical-rag-service && pip install -r requirements.txt

# Development server
dev:
	bun run dev

# Production build
build:
	bun run build

# =============================================================================
# TESTING
# =============================================================================

# Run all tests
test: test-unit test-integration

# Unit tests (placeholder for future unit tests)
test-unit:
	@echo "Running unit tests..."
	@if [ -d "tests/unit" ]; then \
		pytest tests/unit/ -v --tb=short; \
	else \
		echo "No unit tests found. Create tests/unit/ directory."; \
	fi

# Integration tests
# Starts the medical-rag-service, runs tests, then stops the service
test-integration:
	@echo "=========================================="
	@echo "Running Integration Tests"
	@echo "=========================================="
	@echo "Starting medical-rag-service on port 3031..."
	@cd mini-services/medical-rag-service && \
		python -m uvicorn app.main:app --host 0.0.0.0 --port 3031 & \
		SERVICE_PID=$$!; \
		sleep 5; \
		echo "Service started (PID: $$SERVICE_PID)"; \
		echo "Running tests..."; \
		RAG_SERVICE_URL=http://localhost:3031 \
		TEST_SESSION_SECRET=$${SESSION_SECRET:-test-secret-key-for-integration-tests-min-32-chars} \
		pytest tests/integration/ -v --tb=short --timeout=30; \
		TEST_EXIT=$$?; \
		echo "Stopping service..."; \
		kill $$SERVICE_PID 2>/dev/null || true; \
		exit $$TEST_EXIT

# Integration tests with CI output (JUnit XML)
test-integration-ci:
	@echo "=========================================="
	@echo "Running Integration Tests (CI Mode)"
	@echo "=========================================="
	@mkdir -p test-results
	@cd mini-services/medical-rag-service && \
		python -m uvicorn app.main:app --host 0.0.0.0 --port 3031 & \
		SERVICE_PID=$$!; \
		sleep 5; \
		RAG_SERVICE_URL=http://localhost:3031 \
		TEST_SESSION_SECRET=$${SESSION_SECRET:-test-secret-key-for-integration-tests-min-32-chars} \
		pytest tests/integration/ -v --tb=short --timeout=60 \
			--junitxml=test-results/integration.xml \
			--cov=mini-services --cov-report=xml:test-results/coverage.xml; \
		TEST_EXIT=$$?; \
		kill $$SERVICE_PID 2>/dev/null || true; \
		exit $$TEST_EXIT

# Quick integration test (single test file)
test-integration-quick:
	@cd mini-services/medical-rag-service && \
		python -m uvicorn app.main:app --host 0.0.0.0 --port 3031 & \
		SERVICE_PID=$$!; \
		sleep 5; \
		RAG_SERVICE_URL=http://localhost:3031 \
		TEST_SESSION_SECRET=$${SESSION_SECRET:-test-secret-key-for-integration-tests-min-32-chars} \
		pytest tests/integration/$(FILE) -v --tb=short --timeout=30; \
		TEST_EXIT=$$?; \
		kill $$SERVICE_PID 2>/dev/null || true; \
		exit $$TEST_EXIT

# =============================================================================
# SERVICES
# =============================================================================

# Start all mini-services
services-start:
	@echo "Starting all mini-services..."
	@cd mini-services/medical-rag-service && \
		python -m uvicorn app.main:app --host 0.0.0.0 --port 3031 &
	@cd mini-services/langchain-rag-service && \
		python -m uvicorn app.main:app --host 0.0.0.0 --port 3032 &
	@cd mini-services/medasr-service && \
		python -m uvicorn app.main:app --host 0.0.0.0 --port 3033 &
	@sleep 3
	@echo "All services started"

# Stop all mini-services
services-stop:
	@echo "Stopping all mini-services..."
	@pkill -f "uvicorn app.main:app" 2>/dev/null || true
	@echo "All services stopped"

# =============================================================================
# UTILITIES
# =============================================================================

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -rf .next
	rm -rf node_modules
	rm -rf test-results
	rm -rf __pycache__
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	@echo "Clean complete"

# Run linters
lint:
	@echo "Running linters..."
	bun run lint
	@echo "Python linting..."
	@cd mini-services/medical-rag-service && \
		ruff check app/ || echo "ruff not installed, skipping"

# Format code
format:
	@echo "Formatting code..."
	bun run format
	@cd mini-services/medical-rag-service && \
		ruff format app/ || echo "ruff not installed, skipping"

# =============================================================================
# DATABASE
# =============================================================================

# Run Prisma migration
db-migrate:
	npx prisma migrate dev

# Generate Prisma client
db-generate:
	npx prisma generate

# Seed database
db-seed:
	npx prisma db seed

# Reset database (WARNING: destructive)
db-reset:
	npx prisma migrate reset --force

# =============================================================================
# DOCKER
# =============================================================================

# Build Docker image
docker-build:
	docker build -t gelani-healthcare:latest -f Dockerfile .

# Run Docker container
docker-run:
	docker run -p 3000:3000 gelani-healthcare:latest

# Build s6-overlay image
docker-build-s6:
	docker build -t gelani-healthcare-s6:latest -f Dockerfile.s6 .
