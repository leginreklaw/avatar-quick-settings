/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
import GLib from 'gi://GLib';
import AccountsService from 'gi://AccountsService';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as UserWidget from 'resource:///org/gnome/shell/ui/userWidget.js';

export default class QuickSettingsAvatarExtension extends Extension {
    // Attempts the modification. Returns true on success, false if the
    // shell isn't ready yet (so the caller can retry). Any unexpected
    // failure (e.g. shell internals changed in a GNOME update) is caught
    // and logged rather than left to crash or spam uncaught exceptions.
    //
    // Inserts the avatar into the top-level quick settings menu box, above
    // the grid of toggles, so it's visible as soon as the panel is opened
    // (rather than only inside the power/shutdown submenu).
    _modifySystemItem() {
        try {
            const quickSettings = Main.panel.statusArea.quickSettings;
            if (!quickSettings || !quickSettings.menu || !quickSettings.menu.box)
                return false;

            const userManager = AccountsService.UserManager.get_default();
            const user = userManager.get_user(GLib.get_user_name());

            this._avatar = new UserWidget.UserWidget(user);
            quickSettings.menu.box.insert_child_at_index(this._avatar, 0);

            // This GNOME version's UserWidget doesn't put a style class on
            // its label (unlike the icon, which gets 'user-icon user-avatar'),
            // so .user-widget-label in stylesheet.css has nothing to match.
            // Add it manually by finding the St.Label-ish child that isn't
            // the avatar icon.
            for (const child of this._avatar.get_children()) {
                if (child.constructor.name !== 'Avatar')
                    child.add_style_class_name('user-widget-label');
            }

            return true;
        } catch (e) {
            console.error(
                `${this.metadata.name}: failed to add avatar to the ` +
                `quick settings menu. This likely means GNOME Shell's ` +
                `internal quick settings structure has changed and the ` +
                `extension needs to be updated. Original error: ${e}`
            );
            // Don't keep retrying on idle_add if the failure is structural
            // rather than "shell not ready yet".
            this._modificationFailed = true;
            return false;
        }
    }

    _queueModifySystemItem() {
        this._idleId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            if (this._modifySystemItem()) {
                this._idleId = null;
                return GLib.SOURCE_REMOVE;
            }

            if (this._modificationFailed) {
                this._idleId = null;
                return GLib.SOURCE_REMOVE;
            }

            return GLib.SOURCE_CONTINUE;
        });
    }

    enable() {
        this._avatar = null;
        this._idleId = null;
        this._modificationFailed = false;

        if (!this._modifySystemItem())
            this._queueModifySystemItem();
    }

    disable() {
        // Cancel any pending retry so it can't fire after we've disabled.
        if (this._idleId) {
            GLib.source_remove(this._idleId);
            this._idleId = null;
        }

        if (this._avatar) {
            this._avatar.destroy();
            this._avatar = null;
        }
    }
}
