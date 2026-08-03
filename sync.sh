#!/bin/bash
rsync -av --delete \
  ~/Projects/avatar-quick-settings/avatar-quick-settings@github.leginreklaw/ \
  ~/.local/share/gnome-shell/extensions/avatar-quick-settings@github.leginreklaw/

echo "Synced to GNOME extensions directory
