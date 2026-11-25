#!/usr/bin/env bash
# Weekly backup to Google Drive: npm run backup (an AES-256 .7z) → upload with rclone → keep the newest 8 in Drive.
# The .7z is already encrypted with BACKUP_PASSWORD, so Drive gets it as-is, with its real name.
#
#   scripts/backup-to-drive.sh            back up and upload now
#   scripts/backup-to-drive.sh --if-due   only if the last good upload is 7+ days old (what cron runs, hourly)
#   scripts/backup-to-drive.sh --install  add the hourly cron line (catches up after a missed week)
#   scripts/backup-to-drive.sh --status   show the last few log lines
#
# Drive side: the rclone "gdrive" remote (set up once with `rclone config`, scope drive.file), folder "Library backups".
# Open a backup on Windows with 7-Zip/NanaZip or on WSL with `7z x`, using BACKUP_PASSWORD. Lose it = can't be opened.
# Every run appends one line to backups/backup.log.
set -euo pipefail
cd "$(dirname "$0")/.."
APP_DIR=$(pwd)
REMOTE="${BACKUP_REMOTE:-gdrive:Library backups/}"
KEEP_DRIVE=8   # weeks in Drive
KEEP_LOCAL=4   # newest archives kept on this computer
LOG=backups/backup.log
mkdir -p backups
log() { echo "$(date '+%Y-%m-%d %H:%M') $*" | tee -a "$LOG"; }

case "${1:-}" in
  --install)
    line="0 * * * * PATH=$(dirname "$(command -v node)"):/usr/local/bin:/usr/bin:/bin $APP_DIR/scripts/backup-to-drive.sh --if-due >/dev/null 2>&1"
    (crontab -l 2>/dev/null | grep -v 'backup-to-drive.sh' || true; echo "$line") | crontab -
    echo "Installed: checks every hour, uploads when the last good backup is 7+ days old."; exit 0 ;;
  --status) tail -n 8 "$LOG" 2>/dev/null || echo "No backups logged yet."; exit 0 ;;
  --if-due)
    last=$(grep ' ok ' "$LOG" 2>/dev/null | tail -n 1 | cut -c1-16 || true)
    if [ -n "$last" ] && [ $(( $(date +%s) - $(date -d "$last" +%s) )) -lt $((7 * 86400)) ]; then exit 0; fi ;;
  "") ;;
  *) echo "Unknown option $1"; exit 2 ;;
esac

command -v rclone >/dev/null || { log "FAILED: rclone not installed"; exit 1; }
rclone listremotes | grep -qx "${REMOTE%%:*}:" || { log "FAILED: rclone remote ${REMOTE} not set up"; exit 1; }

if ! out=$(npm run -s backup 2>&1); then log "FAILED backup: $(echo "$out" | tail -n 1)"; exit 1; fi
file=$(ls -t backups/backup-*.7z | head -n 1)
name=$(basename "$file")

rclone copy "$file" "$REMOTE" --log-level ERROR || { log "FAILED upload $name"; exit 1; }
# Check the copy in Drive has the same size.
remote_size=$(rclone lsf --format s --files-only "$REMOTE" --include "$name" | head -n 1)
[ "$remote_size" = "$(stat -c %s "$file")" ] || { log "FAILED check: $name size in Drive is '${remote_size}'"; exit 1; }

# Keep the newest KEEP_DRIVE in Drive and KEEP_LOCAL here (names sort by date).
rclone lsf --files-only "$REMOTE" --include 'backup-*.7z' | sort | head -n -"$KEEP_DRIVE" | while read -r old; do rclone deletefile "$REMOTE$old"; done
ls -t backups/backup-*.7z 2>/dev/null | tail -n +$((KEEP_LOCAL + 1)) | xargs -r rm --

log "ok $name ($(du -h "$file" | cut -f1)) uploaded to $REMOTE"
