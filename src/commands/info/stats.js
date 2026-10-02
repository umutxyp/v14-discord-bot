'use strict';

const {
  ButtonBuilder,
  ButtonStyle,
  InteractionContextType,
  OAuth2Scopes,
  PermissionFlagsBits,
  SlashCommandBuilder,
  Status,
  version: djsVersion,
  escapeMarkdown,
} = require('discord.js');
const ui = require('../../utils/ui');

const MAX_LISTED_SHARDS = 15;
const number = (value) => value.toLocaleString('en-US');

/**
 * Runs inside every shard process. It is serialized and sent over IPC,
 * so it must not reference anything outside its own body.
 * @param {import('discord.js').Client} client
 */
const collect = (client) => ({
  ids: client.shard?.ids ?? [0],
  guilds: client.guilds.cache.size,
  members: client.guilds.cache.reduce((total, guild) => total + guild.memberCount, 0),
  ping: client.ws.ping,
  status: client.ws.status,
  memory: process.memoryUsage().rss,
  uptime: client.uptime ?? 0,
});

/**
 * Gathers statistics from all shards, falling back to this shard while others are still starting.
 * @param {import('discord.js').Client<true>} client
 */
async function gather(client) {
  if (!client.shard) return { shards: [collect(client)], partial: false };
  try {
    return { shards: await client.shard.broadcastEval(collect), partial: false };
  } catch {
    return { shards: [collect(client)], partial: true };
  }
}

/** @type {import('../../utils/loader').Command} */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Shows bot statistics across all shards.')
    .setContexts(InteractionContextType.Guild),
  aliases: ['botinfo', 'info', 'istatistik'],
  cooldown: 10,

  async execute(ctx) {
    await ctx.deferReply();

    const { client } = ctx;
    const { shards, partial } = await gather(client);
    const totals = shards.reduce(
      (sum, shard) => ({
        guilds: sum.guilds + shard.guilds,
        members: sum.members + shard.members,
        memory: sum.memory + shard.memory,
      }),
      { guilds: 0, members: 0, memory: 0 },
    );
    const pings = shards.map((shard) => shard.ping).filter((ping) => ping >= 0);
    const averagePing = pings.length ? Math.round(pings.reduce((a, b) => a + b, 0) / pings.length) : null;

    const container = ui
      .container()
      .addSectionComponents((section) =>
        section
          .addTextDisplayComponents((text) =>
            text.setContent(
              [
                `## 📊 ${escapeMarkdown(client.user.username)} statistics`,
                `**Servers:** ${number(totals.guilds)}`,
                `**Members:** ${number(totals.members)}`,
                `**Shards:** ${client.shard?.count ?? 1}`,
              ].join('\n'),
            ),
          )
          .setThumbnailAccessory((thumbnail) => thumbnail.setURL(client.user.displayAvatarURL({ size: 256 }))),
      );

    ui.divider(container);
    container.addTextDisplayComponents((text) =>
      text.setContent(
        [
          `**Uptime:** ${ui.duration(client.uptime)} (online since ${ui.timestamp(client.readyAt, 'f')})`,
          `**Average ping:** ${averagePing === null ? 'n/a' : `${averagePing}ms`}`,
          `**Memory (RSS):** ${ui.megabytes(totals.memory)}`,
          `**Commands:** ${client.commands.size}`,
          `**Runtime:** Node.js ${process.version} · discord.js v${djsVersion}`,
        ].join('\n'),
      ),
    );

    ui.divider(container);
    const rows = shards.slice(0, MAX_LISTED_SHARDS).map((shard) => {
      const icon = shard.status === Status.Ready ? '🟢' : '🟡';
      const ping = shard.ping >= 0 ? `${shard.ping}ms` : 'n/a';
      return `${icon} \`#${shard.ids.join(',')}\` · ${number(shard.guilds)} server${shard.guilds === 1 ? '' : 's'} · ${ping} · ${ui.megabytes(shard.memory)}`;
    });
    if (shards.length > MAX_LISTED_SHARDS) rows.push(`-# …and ${shards.length - MAX_LISTED_SHARDS} more shard processes`);
    if (partial) rows.push('-# Some shards are still starting, showing this shard only.');
    container.addTextDisplayComponents((text) => text.setContent(`### Shards\n${rows.join('\n')}`));

    const invite = client.generateInvite({
      scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands],
      permissions: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.SendMessagesInThreads,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    });
    container.addActionRowComponents((row) =>
      row.setComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Invite me').setEmoji('➕').setURL(invite)),
    );

    return ctx.reply(ui.payload([container]));
  },
};
