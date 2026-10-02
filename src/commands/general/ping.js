'use strict';

const { performance } = require('node:perf_hooks');
const { ButtonBuilder, ButtonStyle, InteractionContextType, SlashCommandBuilder } = require('discord.js');
const ui = require('../../utils/ui');

const colorFor = (ms) => (ms < 150 ? ui.Colors.success : ms < 400 ? ui.Colors.warning : ui.Colors.danger);
const formatMs = (ms) => (ms >= 0 ? `\`${Math.round(ms)}ms\`` : '`n/a`');

/**
 * @param {import('discord.js').Client<true>} client
 * @param {import('discord.js').Guild} guild
 * @param {number | null} roundTrip
 */
function view(client, guild, roundTrip) {
  const { ping } = client.ws;
  const shardId = guild.shardId ?? client.shard?.ids[0] ?? 0;
  const container = ui.container(roundTrip === null ? ui.Colors.brand : colorFor(Math.max(ping, roundTrip)));

  container.addSectionComponents((section) =>
    section
      .addTextDisplayComponents((text) =>
        text.setContent(
          roundTrip === null
            ? '## 🏓 Pinging...'
            : [
                '## 🏓 Pong!',
                `**WebSocket heartbeat:** ${formatMs(ping)}`,
                `**API round-trip:** ${formatMs(roundTrip)}`,
                `**Shard:** \`#${shardId}\` of \`${client.shard?.count ?? 1}\``,
              ].join('\n'),
        ),
      )
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId('ping:refresh')
          .setLabel('Refresh')
          .setEmoji('🔄')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(roundTrip === null),
      ),
  );

  if (roundTrip !== null) container.addTextDisplayComponents((text) => text.setContent(`-# Updated ${ui.timestamp(Date.now())}`));
  return ui.payload([container]);
}

/** @type {import('../../utils/loader').Command} */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription("Shows the bot's latency.")
    .setContexts(InteractionContextType.Guild),
  aliases: ['latency', 'gecikme'],
  cooldown: 5,

  async execute(ctx) {
    const start = performance.now();
    await ctx.reply(view(ctx.client, ctx.guild, null));
    const roundTrip = performance.now() - start;
    return ctx.editReply(view(ctx.client, ctx.guild, roundTrip));
  },

  async handleComponent(interaction, [action]) {
    if (action !== 'refresh') return;
    const start = performance.now();
    await interaction.deferUpdate();
    const roundTrip = performance.now() - start;
    return interaction.editReply(view(interaction.client, interaction.guild, roundTrip));
  },
};
