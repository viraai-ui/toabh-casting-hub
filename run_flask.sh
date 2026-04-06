#!/bin/bash
cd /Users/aineshsikdar/github-dashboards/toabh-casting-hub
export FLASK_APP="api/index.py"
export APP_RUNTIME_ROOT="/Users/aineshsikdar/github-dashboards/toabh-casting-hub/backend"
exec /Users/aineshsikdar/.hermes/hermes-agent/venv/bin/python -m flask run --host=0.0.0.0 --port=5000
