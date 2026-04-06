#!/usr/bin/env bash
# Patch openclaw to emit thinking stream events for webchat sessions.
# The upstream package gates emitReasoningStream on onReasoningStream
# (a channel-specific callback) being provided, but webchat sessions
# never receive it due to internal_webchat typing policy suppression.
# These patches decouple the WS broadcast (emitAgentEvent) from the
# channel callback so thinking events are emitted for all channels.
# Remove once upstream openclaw supports webchat reasoning streaming.

set -euo pipefail

PI_FILE="node_modules/openclaw/dist/pi-embedded-CQnl8oWA.js"

if [ ! -f "$PI_FILE" ]; then
  echo "[patch-openclaw-reasoning] $PI_FILE not found, skipping."
  exit 0
fi

if grep -q 'streamReasoning: reasoningMode === "stream" && typeof params.onReasoningStream' "$PI_FILE"; then
  sed -i.bak \
    -e 's/streamReasoning: reasoningMode === "stream" && typeof params.onReasoningStream === "function"/streamReasoning: reasoningMode === "stream"/' \
    -e 's/if (!state.streamReasoning || !params.onReasoningStream) return;/if (!state.streamReasoning) return;/' \
    -e 's/params.onReasoningStream({ text: formatted });/params.onReasoningStream?.({ text: formatted });/' \
    "$PI_FILE"
  rm -f "${PI_FILE}.bak"
  echo "[patch-openclaw-reasoning] Patched $PI_FILE for webchat reasoning streaming."
else
  echo "[patch-openclaw-reasoning] Already patched or file structure changed, skipping."
fi
