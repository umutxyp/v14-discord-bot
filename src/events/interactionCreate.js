'use strict';

const { Events } = require('discord.js');
const CommandContext = require('../structures/CommandContext');
const { runCommand } = require('../utils/runCommand');
const logger = require('../utils/logger');
const ui = require('../utils/ui');

module.exports = {
  name: Events.InteractionCreate,
  /** @param {import('discord.js').Interaction} interaction */
  async execute(interaction) {
    const { client } = interaction;

    // Commands are registered for guilds only (see `setContexts` in each command).
    if (!interaction.inCachedGuild()) return;

    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command || command.slash === false) {
        return interaction.reply(ui.error('This command is no longer available.')).catch(() => null);
      }
      return runCommand(command, new CommandContext({ command, interaction }));
    }

    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      return command?.autocomplete?.(interaction).catch((error) => logger.error('Autocomplete failed:', error));
    }

    if (interaction.isMessageComponent()) {
      // Custom IDs follow the `<command>:<action>:<...params>` convention.
      const [commandName, ...params] = interaction.customId.split(':');
      const command = client.commands.get(commandName);
      if (!command?.handleComponent) return;

      try {
        await command.handleComponent(interaction, params);
      } catch (error) {
        logger.error(`Component "${interaction.customId}" failed:`, error);
        const reply = ui.error('An unexpected error occurred while handling this interaction.');
        await (interaction.replied || interaction.deferred ? interaction.followUp(reply) : interaction.reply(reply)).catch(
          () => null,
        );
      }
    }
  },
};
