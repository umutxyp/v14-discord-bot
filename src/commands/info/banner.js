'use strict';

const { ButtonBuilder, ButtonStyle, InteractionContextType, SlashCommandBuilder, escapeMarkdown } = require('discord.js');
const ui = require('../../utils/ui');

const SIZE = 4096;

const openButton = (label, url) => new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(label).setURL(url);

/** @type {import('../../utils/loader').Command} */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('banner')
    .setDescription("Shows a user's profile and server banner.")
    .setContexts(InteractionContextType.Guild)
    .addUserOption((option) => option.setName('user').setDescription('Whose banner to show (defaults to you)')),
  aliases: ['bnr', 'afis'],
  cooldown: 5,

  async execute(ctx) {
    const target = ctx.options.getUser('user') ?? ctx.user;

    // Banners are only included when the user (and member) are fetched from the API.
    const [user, member] = await Promise.all([
      ctx.client.users.fetch(target.id, { force: true }),
      ctx.guild.members.fetch({ user: target.id, force: true }).catch(() => null),
    ]);

    const globalBanner = user.bannerURL({ size: SIZE });
    const serverBanner = member?.bannerURL({ size: SIZE }) ?? null;
    const name = escapeMarkdown(member?.displayName ?? user.displayName);

    const container = ui
      .container(user.accentColor ?? ui.Colors.brand)
      .addTextDisplayComponents((text) => text.setContent(`## 🎨 ${name}'s banner\n-# ${user} · \`${user.id}\``));

    if (!globalBanner && !serverBanner) {
      const accent = user.hexAccentColor
        ? `\nTheir profile accent color is **${user.hexAccentColor.toUpperCase()}** (shown on the left).`
        : '';
      container.addTextDisplayComponents((text) => text.setContent(`This user has no banner.${accent}`));
      return ctx.reply(ui.payload([container]));
    }

    container.addMediaGalleryComponents((gallery) => {
      if (globalBanner) gallery.addItems((item) => item.setURL(globalBanner).setDescription('Profile banner'));
      if (serverBanner) gallery.addItems((item) => item.setURL(serverBanner).setDescription('Server banner'));
      return gallery;
    });

    container.addActionRowComponents((row) =>
      row.setComponents(
        [
          globalBanner && openButton('Profile banner', globalBanner),
          serverBanner && openButton('Server banner', serverBanner),
        ].filter(Boolean),
      ),
    );

    return ctx.reply(ui.payload([container]));
  },
};
