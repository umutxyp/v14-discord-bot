'use strict';

const { MessageFlags, MessageFlagsBitField } = require('discord.js');
const PrefixOptionResolver = require('./PrefixOptionResolver');

/** Message create/edit payloads must not carry the Ephemeral flag. */
const forMessage = (options) => {
  if (typeof options === 'string' || options.flags === undefined) return options;
  return { ...options, flags: new MessageFlagsBitField(options.flags).remove(MessageFlags.Ephemeral).bitfield };
};

/**
 * A unified wrapper around a slash-command interaction or a prefix-command message.
 * Commands receive this object and never need to care how they were invoked.
 */
class CommandContext {
  /**
   * @param {object} data
   * @param {import('../utils/loader').Command} data.command
   * @param {import('discord.js').ChatInputCommandInteraction<'cached'>} [data.interaction]
   * @param {import('discord.js').Message<true>} [data.message]
   * @param {string[]} [data.args]
   * @param {string} [data.prefix]
   */
  constructor({ command, interaction = null, message = null, args = [], prefix = '/' }) {
    this.command = command;
    this.interaction = interaction;
    this.message = message;
    this.args = args;
    this.prefix = interaction ? '/' : prefix;
    /** @type {import('discord.js').CommandInteractionOptionResolver | PrefixOptionResolver | null} */
    this.options = interaction?.options ?? null;
    /** The reply sent to a prefix command, kept so it can be edited later. */
    this.response = null;
  }

  /** @returns {this is { interaction: import('discord.js').ChatInputCommandInteraction<'cached'> }} */
  isInteraction() {
    return this.interaction !== null;
  }

  get source() {
    return this.interaction ?? this.message;
  }

  get client() {
    return this.source.client;
  }

  get user() {
    return this.interaction?.user ?? this.message.author;
  }

  get member() {
    return this.source.member;
  }

  get guild() {
    return this.source.guild;
  }

  get channel() {
    return this.source.channel;
  }

  get createdTimestamp() {
    return this.source.createdTimestamp;
  }

  /** Permissions of the invoking member in the current channel. */
  get memberPermissions() {
    return this.interaction?.memberPermissions ?? this.message.member?.permissionsIn(this.message.channel) ?? null;
  }

  /** Permissions of the bot in the current channel. */
  get appPermissions() {
    return this.interaction?.appPermissions ?? this.message.channel.permissionsFor(this.message.guild.members.me) ?? null;
  }

  /** Parses prefix arguments against the command's slash definition (no-op for interactions). */
  async resolveOptions() {
    if (this.options) return this.options;
    this.options = await PrefixOptionResolver.resolve(this.message, this.args, this.command.data.toJSON());
    return this.options;
  }

  /**
   * Sends the response. Subsequent calls follow up (interaction) or send another reply (prefix).
   * @param {string | import('discord.js').InteractionReplyOptions} options
   * @returns {Promise<import('discord.js').Message | null>}
   */
  async reply(options) {
    if (this.interaction) {
      const { interaction } = this;
      if (interaction.replied) return interaction.followUp(options);
      if (interaction.deferred) return interaction.editReply(forMessage(options));
      const response = await interaction.reply({
        ...(typeof options === 'string' ? { content: options } : options),
        withResponse: true,
      });
      return response.resource?.message ?? null;
    }

    const sent = await this.message.reply(forMessage(options));
    this.response ??= sent;
    return sent;
  }

  /**
   * Edits the first response.
   * @param {string | import('discord.js').InteractionEditReplyOptions} options
   */
  async editReply(options) {
    if (this.interaction) return this.interaction.editReply(forMessage(options));
    if (!this.response) return this.reply(options);
    return this.response.edit(forMessage(options));
  }

  /**
   * Acknowledges a slow command. Interactions show "thinking...", prefix commands show "typing...".
   * @param {{ ephemeral?: boolean }} [options]
   */
  async deferReply({ ephemeral = false } = {}) {
    if (this.interaction) {
      if (this.interaction.deferred || this.interaction.replied) return;
      await this.interaction.deferReply(ephemeral ? { flags: MessageFlags.Ephemeral } : {});
      return;
    }
    await this.message.channel.sendTyping().catch(() => null);
  }
}

module.exports = CommandContext;
