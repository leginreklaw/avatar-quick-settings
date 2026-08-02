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
    // Find the ShutdownItem inside the system quick settings item.
    // Kept as an instance method (not module-level code) so it only
    // ever runs while the extension is actually enabled.
    _findShutdownItem(children) {
        for (const child of children) {
            if (child.constructor.name === 'ShutdownItem')
                return child;
        }
        return null;
    }

    // Attempts the modification. Returns true on success, false if the
    // shell isn't ready yet (so the caller can retry). Any unexpected
    // failure (e.g. shell internals changed in a GNOME update) is caught
    // and logged rather than left to crash or spam uncaught exceptions.
    _modifySystemItem() {
        try {
            const system = Main.panel.statusArea.quickSettings._system;
            if (!system)
                return false;

            const children = system._systemItem.child.get_children();
            const shutdownItem = this._findShutdownItem(children);
            if (!shutdownItem)
                return false;

            this._shutdownItem = shutdownItem;
            this._shutdownItem.menu._header.hide();

            const userManager = AccountsService.UserManager.get_default();
            const user = userManager.get_user(GLib.get_user_name());

            this._avatar = new UserWidget.UserWidget(user);
            this._shutdownItem.menu.box.insert_child_at_index(this._avatar, 1);

            return true;
        } catch (e) {
            console.error(
                `${this.metadata.name}: failed to add avatar to the ` +
                `power menu. This likely means GNOME Shell's internal ` +
                `quick settings structure has changed and the extension ` +
                `needs to be updated. Original error: ${e}`
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
        this._shutdownItem = null;
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

        if (this._shutdownItem) {
            this._shutdownItem.menu._header.show();
            this._shutdownItem = null;
        }
    }
}