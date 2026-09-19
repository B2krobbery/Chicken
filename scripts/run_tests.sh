#!/usr/bin/env bash
set -e

echo "🧪 Running TheChickenMan Automated Pytest Verification Suite..."
cd "$(dirname "$0")/../backend"
source ../.venv/bin/activate

PYTHONPATH=. pytest -v --tb=short "$@"
