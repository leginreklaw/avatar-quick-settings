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
import GObject from 'gi://GObject';
import AccountsService from 'gi://AccountsService';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as UserWidget from 'resource:///org/gnome/shell/ui/userWidget.js';

export default class QuickSettingsAvatarExtension extends Extension {
    enable() {
        this._avatar = null;
        this._idleId = 0;
        this._modificationFailed = false;

        Main.panel.statusArea.quickSettings.connectObject(
            'destroy',
            () => this._removeAvatar(),
            this
        );

        if (!this._modifySystemItem())
            this._queueModifySystemItem();
    }

    disable() {
        Main.panel.statusArea.quickSettings?.disconnectObject(this);

        if (this._idleId) {
            GLib.source_remove(this._idleId);
            this._idleId = 0;
        }

        this._removeAvatar();
    }

    _removeAvatar() {
        if (this._avatar) {
            this._avatar.destroy();
            this._avatar = null;
        }
    }

    _modifySystemItem() {
        if (this._avatar)
            return true;

        try {
            const quickSettings = Main.panel.statusArea.quickSettings;
            const menuBox = quickSettings?.menu?.box;

            if (!menuBox)
                return false;

            const userManager = AccountsService.UserManager.get_default();
            const user = userManager.get_user(GLib.get_user_name());

            this._avatar = new UserWidget.UserWidget(user);

            menuBox.insert_child_at_index(this._avatar, 0);

            for (const child of this._avatar.get_children()) {
                if (!(child instanceof GObject.Object))
                    continue;

                if (!child.has_style_class_name?.('user-icon'))
                    child.add_style_class_name?.('user-widget-label');
            }

            return true;
        } catch (e) {
            logError(
                e,
                `${this.metadata.name}: failed to add avatar to quick settings`
            );

            this._modificationFailed = true;
            return false;
        }
    }

    _queueModifySystemItem() {
        if (this._idleId)
            return;

        this._idleId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            const done =
                this._modifySystemItem() || this._modificationFailed;

            if (done)
                this._idleId = 0;

            return done ? GLib.SOURCE_REMOVE : GLib.SOURCE_CONTINUE;
        });
    }
}