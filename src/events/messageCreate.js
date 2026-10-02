'use strict';

const { Events, PermissionFlagsBits } = require('discord.js');
const config = require('../config');
const CommandContext = require('../structures/CommandContext');
const { tokenize } = require('../structures/PrefixOptionResolver');
const { runCommand } = require('../utils/runCommand');
const ui = require('../utils/ui');

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = {
  name: Events.MessageCreate,
  /** @param {import('discord.js').Message} message */
  async execute(message) {
    if (!config.prefix.enabled || message.author.bot || message.webhookId || !message.inGuild()) return;

    const { client } = message;
    const match = message.content.match(new RegExp(`^(<@!?${client.user.id}>|${escapeRegex(config.prefix.value)})\\s*`));
    if (!match) return;

    // Make sure we are allowed to answer in this channel at all.
    const me = message.guild.members.me;
    const sendPermission = message.channel.isThread()
      ? PermissionFlagsBits.SendMessagesInThreads
      : PermissionFlagsBits.SendMessages;
    if (!me || !message.channel.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel, sendPermission])) return;

    const [name, ...args] = tokenize(message.content.slice(match[0].length));

    if (!name) {
      // The bot was only mentioned: tell the user how to use it.
      if (match[1] === config.prefix.value) return;
      return message
        .reply(
          ui.success(`My prefix is \`${config.prefix.value}\`. Try \`${config.prefix.value}help\` or \`/help\`.`, {
            title: '👋 Hi there!',
          }),
        )
        .catch(() => null);
    }

    const key = name.toLowerCase();
    const command = client.commands.get(key) ?? client.commands.get(client.aliases.get(key));
    if (!command || command.prefix === false) return;

    return runCommand(
      command,
      new CommandContext({
        command,
        message,
        args,
        prefix: match[1].startsWith('<@') ? `@${client.user.username} ` : config.prefix.value,
      }),
    );
  },
};
