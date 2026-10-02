'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Collection } = require('discord.js');
const logger = require('./logger');

/**
 * @typedef {object} Command
 * @property {import('discord.js').SlashCommandBuilder | import('discord.js').SlashCommandOptionsOnlyBuilder | import('discord.js').SlashCommandSubcommandsOnlyBuilder} data
 *   Slash command definition. Prefix arguments are parsed from these same options.
 * @property {(ctx: import('../structures/CommandContext')) => Promise<unknown>} execute
 * @property {string[]} [aliases] Extra prefix names, e.g. `['av', 'pp']`.
 * @property {number} [cooldown] Per-user cooldown in seconds.
 * @property {boolean} [slash] Set to `false` to disable the slash version.
 * @property {boolean} [prefix] Set to `false` to disable the prefix version.
 * @property {boolean} [ownerOnly] Only users listed in `OWNER_IDS` can run it.
 * @property {{ user?: bigint[], bot?: bigint[] }} [permissions] Required permissions (`PermissionFlagsBits`).
 * @property {(interaction: import('discord.js').MessageComponentInteraction<'cached'>, params: string[]) => Promise<unknown>} [handleComponent]
 *   Handles buttons / select menus whose custom ID starts with `<command name>:`.
 * @property {(interaction: import('discord.js').AutocompleteInteraction<'cached'>) => Promise<unknown>} [autocomplete]
 * @property {string} category Filled in by the loader from the folder name.
 */

/** Recursively lists `.js` files inside a directory. */
function readFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return readFiles(fullPath);
    return entry.isFile() && entry.name.endsWith('.js') ? [fullPath] : [];
  });
}

/**
 * Loads every command inside `src/commands/<category>/<name>.js`.
 * @param {{ silent?: boolean }} [options]
 */
function loadCommands({ silent = false } = {}) {
  const root = path.join(__dirname, '..', 'commands');
  /** @type {Collection<string, Command>} */
  const commands = new Collection();
  /** @type {Collection<string, string>} */
  const aliases = new Collection();

  for (const file of readFiles(root)) {
    const relative = path.relative(root, file);
    /** @type {Command} */
    const command = require(file);

    if (typeof command?.data?.toJSON !== 'function' || typeof command.execute !== 'function') {
      logger.warn(`Skipped ${relative}: a command must export "data" (SlashCommandBuilder) and "execute".`);
      continue;
    }

    const { name } = command.data;
    if (commands.has(name) || aliases.has(name)) {
      throw new Error(`Duplicate command name "${name}" in ${relative}.`);
    }

    command.category = path.dirname(relative) === '.' ? 'general' : path.dirname(relative).split(path.sep)[0];
    command.aliases ??= [];
    commands.set(name, command);

    for (const alias of command.aliases) {
      const key = alias.toLowerCase();
      if (commands.has(key) || aliases.has(key)) throw new Error(`Alias "${key}" of "${name}" is already in use.`);
      aliases.set(key, name);
    }
  }

  if (!silent) logger.info(`Loaded ${commands.size} commands (${aliases.size} aliases).`);
  return { commands, aliases };
}

/**
 * Registers every event inside `src/events`.
 * Each file exports `{ name, once?, execute(...args) }`.
 * @param {import('discord.js').Client} client
 */
function loadEvents(client) {
  const root = path.join(__dirname, '..', 'events');
  let count = 0;

  for (const file of readFiles(root)) {
    const event = require(file);
    if (!event?.name || typeof event.execute !== 'function') {
      logger.warn(`Skipped event ${path.relative(root, file)}: missing "name" or "execute".`);
      continue;
    }

    const listener = async (...args) => {
      try {
        await event.execute(...args);
      } catch (error) {
        logger.error(`Unhandled error in "${event.name}" event:`, error);
      }
    };

    client[event.once ? 'once' : 'on'](event.name, listener);
    count++;
  }

  logger.info(`Registered ${count} event listeners.`);
}

module.exports = { loadCommands, loadEvents };
