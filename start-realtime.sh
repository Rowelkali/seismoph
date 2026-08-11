#!/bin/bash
cd /home/z/my-project/mini-services/realtime-service
while true; do
  echo "[$(date -u '+%H:%M:%S')] Starting realtime service..."
  bun index.ts >> /home/z/my-project/rt.log 2>&1
  EXIT_CODE=$?
  echo "[$(date -u '+%H:%M:%S')] Realtime service exited with code $EXIT_CODE. Restarting in 3s..."
  sleep 3
done
