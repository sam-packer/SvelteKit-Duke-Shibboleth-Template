#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEMPLATE="$SCRIPT_DIR/duke-shibboleth-sveltekit.service"

SERVICE_NAME="duke-shibboleth-sveltekit"
SERVICE_USER="www-data"
HOST="127.0.0.1"
PORT="8421"
NODE_BIN=""
ENABLE=false

usage() {
	cat <<EOF
Usage: $0 [options]

Installs the systemd unit for this project, substituting paths and user.

Options:
  -u, --user <user>    System user to run as       (default: $SERVICE_USER)
  -n, --name <name>    Service name                (default: $SERVICE_NAME)
  -p, --port <port>    Port to bind                (default: $PORT)
  -H, --host <host>    Host to bind                (default: $HOST)
  -N, --node <path>    Path to node binary         (default: \$(command -v node))
  -e, --enable         Enable + start after install
  -h, --help           Show this help

Project root is auto-detected as: $PROJECT_ROOT
EOF
}

while [[ $# -gt 0 ]]; do
	case "$1" in
		-u|--user) SERVICE_USER="$2"; shift 2 ;;
		-n|--name) SERVICE_NAME="$2"; shift 2 ;;
		-p|--port) PORT="$2"; shift 2 ;;
		-H|--host) HOST="$2"; shift 2 ;;
		-N|--node) NODE_BIN="$2"; shift 2 ;;
		-e|--enable) ENABLE=true; shift ;;
		-h|--help) usage; exit 0 ;;
		*) echo "Unknown option: $1" >&2; usage; exit 1 ;;
	esac
done

if [[ -z "$NODE_BIN" ]]; then
	NODE_BIN="$(command -v node || true)"
fi
if [[ -z "$NODE_BIN" || ! -x "$NODE_BIN" ]]; then
	echo "Error: node binary not found. Pass --node <path> or install node." >&2
	exit 1
fi

if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
	echo "Error: user '$SERVICE_USER' does not exist." >&2
	exit 1
fi

if [[ ! -f "$TEMPLATE" ]]; then
	echo "Error: template not found at $TEMPLATE" >&2
	exit 1
fi

if [[ ! -d "$PROJECT_ROOT/build" ]]; then
	echo "Warning: '$PROJECT_ROOT/build' is missing — run 'bun run build' before starting." >&2
fi

if [[ ! -f "$PROJECT_ROOT/.env" ]]; then
	echo "Warning: '$PROJECT_ROOT/.env' is missing — the service will fail to start without it." >&2
fi

UNIT_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
SUDO="sudo"
[[ $EUID -eq 0 ]] && SUDO=""

echo "Installing $UNIT_FILE"
echo "  User:         $SERVICE_USER"
echo "  Project root: $PROJECT_ROOT"
echo "  Node:         $NODE_BIN"
echo "  Bind:         $HOST:$PORT"

sed \
	-e "s|@@USER@@|$SERVICE_USER|g" \
	-e "s|@@PROJECT_ROOT@@|$PROJECT_ROOT|g" \
	-e "s|@@NODE_BIN@@|$NODE_BIN|g" \
	-e "s|@@HOST@@|$HOST|g" \
	-e "s|@@PORT@@|$PORT|g" \
	-e "s|@@SERVICE_NAME@@|$SERVICE_NAME|g" \
	"$TEMPLATE" | $SUDO tee "$UNIT_FILE" > /dev/null

if [[ -d "$PROJECT_ROOT/certs" ]]; then
	$SUDO chown -R "$SERVICE_USER:$SERVICE_USER" "$PROJECT_ROOT/certs"
fi

$SUDO systemctl daemon-reload

if [[ "$ENABLE" == "true" ]]; then
	$SUDO systemctl enable --now "$SERVICE_NAME"
	$SUDO systemctl status "$SERVICE_NAME" --no-pager
else
	echo
	echo "Installed. To enable and start:"
	echo "  sudo systemctl enable --now $SERVICE_NAME"
	echo "  sudo journalctl -u $SERVICE_NAME -f"
fi
