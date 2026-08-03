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
import * as GLib from 'gi://GLib';
import * as AccountsService from 'gi://AccountsService';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as UserWidget from 'resource:///org/gnome/shell/ui/userWidget.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

export default class QuickSettingsAvatarExtension extends Extension {
    _createAvatarWidget() {
        const userManager = AccountsService.UserManager.get_default();
        const user = userManager.get_user(GLib.get_user_name());

        this._avatar = new UserWidget.UserWidget(user);

        const quickSettings = Main.panel.statusArea.quickSettings;
        if (!quickSettings?.menu?.box)
            return false;

        quickSettings.menu.box.insert_child_at_index(this._avatar, 0);

        for (const child of this._avatar.get_children()) {
            if (child.constructor.name !== 'Avatar')
                child.add_style_class_name('user-widget-label');
        }

        return true;
    }

    _setupUser() {
        const userManager = AccountsService.UserManager.get_default();

        // If AccountsService hasn't finished loading user data over DBus, wait for it
        if (!userManager.is_loaded) {
            this._userLoadedId = userManager.connect('notify::is-loaded', () => {
                if (this._userLoadedId) {
                    userManager.disconnect(this._userLoadedId);
                    this._userLoadedId = null;
                }
                this._modifySystemItem();
            });
            return false;
        }

        return this._createAvatarWidget();
    }

    _modifySystemItem() {
        try {
            return this._setupUser();
        } catch (e) {
            console.error(`${this.metadata.name}: Error setting up avatar: ${e}`);
            this._modificationFailed = true;
            return false;
        }
    }

    _queueModifySystemItem() {
        this._idleId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            if (this._modifySystemItem() || this._modificationFailed) {
                this._idleId = null;
                return GLib.SOURCE_REMOVE;
            }
            return GLib.SOURCE_CONTINUE;
        });
    }

    enable() {
        this._avatar = null;
        this._idleId = null;
        this._userLoadedId = null;
        this._modificationFailed = false;

        if (!this._modifySystemItem())
            this._queueModifySystemItem();
    }

    disable() {
        // 1. Remove main loop idle sources using GLib.Source.remove
        if (this._idleId) {
            GLib.Source.remove(this._idleId);
            this._idleId = null;
        }

        // 2. Disconnect any pending DBus signal handlers
        if (this._userLoadedId) {
            const userManager = AccountsService.UserManager.get_default();
            userManager.disconnect(this._userLoadedId);
            this._userLoadedId = null;
        }

        // 3. Destroy created UI widgets
        if (this._avatar) {
            this._avatar.destroy();
            this._avatar = null;
        }
    }
}