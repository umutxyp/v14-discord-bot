'use strict';

const { ApplicationCommandOptionType: OptionType } = require('discord.js');

const isBranch = (option) => option.type === OptionType.Subcommand || option.type === OptionType.SubcommandGroup;

const formatOptions = (options = []) =>
  options
    .filter((option) => !isBranch(option))
    .map((option) => (option.required ? `<${option.name}>` : `[${option.name}]`))
    .join(' ');

/**
 * Builds usage lines from a command's slash definition, e.g. `!avatar [user]`.
 * @param {import('./loader').Command} command
 * @param {string} prefix `/` for slash commands or the prefix in use.
 * @returns {string[]}
 */
function formatUsage(command, prefix) {
  const json = command.data.toJSON();
  const lines = [];

  const walk = (options, path) => {
    const branches = (options ?? []).filter(isBranch);
    if (!branches.length) {
      lines.push(`${prefix}${[...path, formatOptions(options)].filter(Boolean).join(' ')}`);
      return;
    }
    for (const branch of branches) walk(branch.options, [...path, branch.name]);
  };

  walk(json.options, [json.name]);
  return lines;
}

module.exports = { formatUsage };
