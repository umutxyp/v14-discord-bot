'use strict';

const { ButtonBuilder, ButtonStyle, InteractionContextType, SlashCommandBuilder, escapeMarkdown } = require('discord.js');
const ui = require('../../utils/ui');

const SIZE = 4096;

/** Download buttons for every format Discord serves for this image hash. */
function formatButtons(target) {
  if (!target.avatar) {
    return [
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('Open')
        .setURL(target.displayAvatarURL({ size: SIZE })),
    ];
  }

  const formats = ['png', 'jpg', 'webp'].map((extension) =>
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel(extension.toUpperCase())
      .setURL(target.displayAvatarURL({ extension, forceStatic: true, size: SIZE })),
  );
  if (target.avatar.startsWith('a_')) {
    formats.push(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('GIF')
        .setURL(target.displayAvatarURL({ size: SIZE })),
    );
  }
  return formats;
}

/** @type {import('../../utils/loader').Command} */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription("Shows a user's global and server avatar.")
    .setContexts(InteractionContextType.Guild)
    .addUserOption((option) => option.setName('user').setDescription('Whose avatar to show (defaults to you)')),
  aliases: ['av', 'pp', 'pfp'],
  cooldown: 3,

  async execute(ctx) {
    const user = ctx.options.getUser('user') ?? ctx.user;
    const member = ctx.options.getMember('user') ?? (user.id === ctx.user.id ? ctx.member : null);
    const serverAvatar = member?.avatar ? member : null;

    const container = ui
      .container(user.accentColor ?? ui.Colors.brand)
      .addTextDisplayComponents((text) =>
        text.setContent(`## 🖼️ ${escapeMarkdown(member?.displayName ?? user.displayName)}'s avatar\n-# ${user} · \`${user.id}\``),
      )
      .addMediaGalleryComponents((gallery) => {
        gallery.addItems((item) => item.setURL(user.displayAvatarURL({ size: SIZE })).setDescription('Global avatar'));
        if (serverAvatar) {
          gallery.addItems((item) => item.setURL(serverAvatar.avatarURL({ size: SIZE })).setDescription('Server avatar'));
        }
        return gallery;
      })
      .addActionRowComponents((row) => row.setComponents(formatButtons(user)));

    if (serverAvatar) {
      container
        .addTextDisplayComponents((text) => text.setContent('-# Server avatar'))
        .addActionRowComponents((row) => row.setComponents(formatButtons(serverAvatar)));
    }

    return ctx.reply(ui.payload([container]));
  },
};
