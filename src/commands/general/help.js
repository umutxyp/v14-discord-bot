'use strict';

const { InteractionContextType, SlashCommandBuilder, StringSelectMenuBuilder, escapeMarkdown } = require('discord.js');
const config = require('../../config');
const UsageError = require('../../structures/UsageError');
const ui = require('../../utils/ui');
const { formatUsage } = require('../../utils/usage');
const { missingPermissions } = require('../../utils/permissions');

const CATEGORY_EMOJIS = { general: '🧭', info: '📊' };
const emojiFor = (category) => CATEGORY_EMOJIS[category] ?? '📁';
const titleCase = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/** Groups the visible commands by their category folder. */
function categoriesOf(client) {
  const categories = new Map();
  for (const command of client.commands.values()) {
    if (!categories.has(command.category)) categories.set(command.category, []);
    categories.get(command.category).push(command);
  }
  return categories;
}

/** One line per command, showing both the slash and the prefix form. */
function describe(command) {
  const forms = [];
  if (command.slash !== false) forms.push(`\`/${command.data.name}\``);
  if (config.prefix.enabled && command.prefix !== false) {
    forms.push([command.data.name, ...command.aliases].map((name) => `\`${config.prefix.value}${name}\``).join(' '));
  }
  return `${forms.join(' · ')}\n-# ${command.data.description}`;
}

/**
 * The interactive overview: one category at a time, switched with a select menu.
 * @param {import('discord.js').Client<true>} client
 * @param {string} userId Only this user may use the select menu.
 * @param {string} [selected]
 */
function overview(client, userId, selected) {
  const categories = categoriesOf(client);
  const current = categories.has(selected) ? selected : [...categories.keys()][0];
  const prefixHint = config.prefix.enabled ? ` or \`${config.prefix.value}command\`` : '';

  const container = ui
    .container()
    .addSectionComponents((section) =>
      section
        .addTextDisplayComponents((text) =>
          text.setContent(
            `## 📖 ${escapeMarkdown(client.user.username)} — Help\n` +
              `Use \`/command\`${prefixHint} to run a command.\n` +
              `Type \`/help command:<name>\` for details. **${client.commands.size}** commands in **${categories.size}** categories.`,
          ),
        )
        .setThumbnailAccessory((thumbnail) => thumbnail.setURL(client.user.displayAvatarURL({ size: 256 }))),
    );

  ui.divider(container);
  container.addTextDisplayComponents((text) =>
    text.setContent(`### ${emojiFor(current)} ${titleCase(current)}\n${categories.get(current).map(describe).join('\n')}`),
  );

  container.addActionRowComponents((row) =>
    row.setComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`help:category:${userId}`)
        .setPlaceholder('Choose a category')
        .addOptions(
          [...categories].map(([name, commands]) => ({
            label: titleCase(name),
            value: name,
            emoji: emojiFor(name),
            description: `${commands.length} command${commands.length === 1 ? '' : 's'}`,
            default: name === current,
          })),
        ),
    ),
  );

  return ui.payload([container]);
}

/** Detailed card for a single command. */
function details(command, prefix) {
  const usage = [
    ...(command.slash !== false ? formatUsage(command, '/') : []),
    ...(config.prefix.enabled && command.prefix !== false
      ? formatUsage(command, prefix === '/' ? config.prefix.value : prefix)
      : []),
  ];
  const userPermissions = missingPermissions(null, command.permissions?.user);

  const lines = [
    `## ${emojiFor(command.category)} ${command.data.name}`,
    command.data.description,
    '',
    `**Category:** ${titleCase(command.category)}`,
    `**Aliases:** ${command.aliases.length ? command.aliases.map((alias) => `\`${alias}\``).join(', ') : 'none'}`,
    `**Cooldown:** ${command.cooldown ?? config.defaultCooldown}s`,
  ];
  if (userPermissions.length) lines.push(`**Requires:** ${userPermissions.join(', ')}`);
  if (command.ownerOnly) lines.push('**Owner only:** yes');

  const container = ui.container().addTextDisplayComponents((text) => text.setContent(lines.join('\n')));
  ui.divider(container);
  container.addTextDisplayComponents((text) =>
    text.setContent(`### Usage\n${usage.map((line) => `\`${line}\``).join('\n')}\n-# <required> [optional]`),
  );
  return ui.payload([container]);
}

/** @type {import('../../utils/loader').Command} */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Lists every command or shows details about one.')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) =>
      option.setName('command').setDescription('A command to get details about').setAutocomplete(true).setMaxLength(32),
    ),
  aliases: ['h', 'commands', 'yardim'],
  cooldown: 3,

  async execute(ctx) {
    const query = ctx.options.getString('command')?.toLowerCase();
    if (!query) return ctx.reply(overview(ctx.client, ctx.user.id));

    const command = ctx.client.commands.get(query) ?? ctx.client.commands.get(ctx.client.aliases.get(query));
    if (!command) throw new UsageError(`There is no command called \`${escapeMarkdown(query)}\`.`);
    return ctx.reply(details(command, ctx.prefix));
  },

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const choices = interaction.client.commands
      .filter((command) => command.data.name.includes(focused))
      .first(25)
      .map((command) => ({ name: `${command.data.name} — ${command.data.description}`.slice(0, 100), value: command.data.name }));
    return interaction.respond(choices);
  },

  async handleComponent(interaction, [action, ownerId]) {
    if (action !== 'category' || !interaction.isStringSelectMenu()) return;
    if (interaction.user.id !== ownerId) {
      return interaction.reply(ui.warning('This menu belongs to someone else. Run `/help` to get your own.'));
    }
    return interaction.update(overview(interaction.client, ownerId, interaction.values[0]));
  },
};
