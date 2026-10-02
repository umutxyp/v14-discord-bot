'use strict';

const { PermissionsBitField } = require('discord.js');

/**
 * Returns the human readable names of the permissions that are missing.
 * @param {Readonly<PermissionsBitField> | null} permissions
 * @param {bigint[]} [required]
 */
function missingPermissions(permissions, required = []) {
  if (!required.length) return [];
  const missing = permissions ? permissions.missing(required) : new PermissionsBitField(required).toArray();
  return missing.map((name) => name.replace(/([a-z])([A-Z])/g, '$1 $2'));
}

module.exports = { missingPermissions };
