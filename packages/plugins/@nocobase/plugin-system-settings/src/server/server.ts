/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import PluginFileManagerServer from '@nocobase/plugin-file-manager';
import { InstallOptions, Plugin } from '@nocobase/server';
import { resolve } from 'path';

export class PluginSystemSettingsServer extends Plugin {
  getInitAppLang(options) {
    return options?.cliArgs?.[0]?.opts?.lang || process.env.INIT_APP_LANG || 'en-US';
  }

  async install(options?: InstallOptions) {
    const plugin = this.pm.get('file-manager') as PluginFileManagerServer;
    const brandTitle = process.env.BRAND_TEXT || 'App';
    const logoUrl = process.env.BRAND_LOGO_URL;
    const logoPath = process.env.BRAND_LOGO_PATH;
    const poweredBy = process.env.BRAND_POWERED_BY;
    let logo;
    if (logoUrl) {
      logo = { title: 'brand-logo', url: logoUrl };
    } else if (logoPath) {
      if (plugin) {
        logo = await plugin.createFileRecord({
          filePath: resolve(process.cwd(), logoPath),
          collectionName: 'attachments',
          values: {
            title: 'brand-logo',
          },
        });
      } else {
        logo = {
          title: 'brand-logo',
          filename: logoPath.split('/').pop(),
          url: `/${logoPath.split('/').pop()}`,
        };
      }
    }
    await this.db.getRepository('systemSettings').create({
      values: {
        title: brandTitle,
        appLang: this.getInitAppLang(options),
        enabledLanguages: [this.getInitAppLang(options)],
        options: poweredBy ? { poweredBy } : {},
        ...(logo ? { logo } : {}),
      },
    });
  }

  async getSystemSettingsInstance() {
    const repository = this.db.getRepository('systemSettings');
    const instance = await repository.findOne({
      filterByTk: 1,
      appends: ['logo'],
    });
    const json = instance.toJSON();
    json.raw_title = json.title;
    json.title = process.env.BRAND_TEXT
      ? process.env.BRAND_TEXT
      : this.app.environment.renderJsonTemplate(instance.title);
    if (process.env.BRAND_LOGO_URL) {
      json.logo = json.logo || {};
      json.logo.url = process.env.BRAND_LOGO_URL;
    }
    if (process.env.BRAND_POWERED_BY) {
      json.options = json.options || {};
      json.options.poweredBy = process.env.BRAND_POWERED_BY;
    }
    return json;
  }

  beforeLoad() {
    const cmd = this.app.findCommand('install');
    if (cmd) {
      cmd.option('-l, --lang [lang]');
    }

    this.app.acl.registerSnippet({
      name: `pm.${this.name}.system-settings`,
      actions: ['systemSettings:put'],
    });
  }

  async load() {
    this.app.acl.addFixedParams('systemSettings', 'destroy', () => {
      return {
        'id.$ne': 1,
      };
    });
    this.app.resourceManager.define({
      name: 'systemSettings',
      actions: {
        get: async (ctx, next) => {
          try {
            ctx.body = await this.getSystemSettingsInstance();
          } catch (error) {
            throw error;
          }
          await next();
        },
        put: async (ctx, next) => {
          const repository = this.db.getRepository('systemSettings');
          const values = ctx.action.params.values;
          await repository.update({
            filterByTk: 1,
            values: {
              ...values,
              title: values.raw_title,
            },
          });
          ctx.body = await this.getSystemSettingsInstance();
          await next();
        },
      },
    });
    this.app.acl.allow('systemSettings', 'get', 'public');
  }
}

export default PluginSystemSettingsServer;
