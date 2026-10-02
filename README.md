# ⚡ Discord Slash & Prefix Command Bot (discord.js v14)

A production-ready Discord bot template built on **discord.js v14.27** with:

- **One command, two ways to run it:** every command works as both `/command` and `!command`, from a single file
- **Components V2 UI:** containers, sections, thumbnails, media galleries, buttons and select menus instead of embeds
- **Sharding out of the box:** a `ShardingManager` that validates the token, syncs slash commands once and spawns shards

> This repository merges and replaces the old `discordJS-V14`, `discordjs-14-slash-and-prefix-command-bot` and
> `slash-command-bot` templates.

## ✨ Features

| Feature                       | Details                                                                                                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unified commands              | One `execute(ctx)` for slash and prefix commands. Prefix arguments are parsed from the slash options: users, roles, channels, numbers, booleans, choices, subcommands and `"quoted text"`. |
| Components V2                 | `IsComponentsV2` messages with interactive buttons and select menus, routed by custom ID (`<command>:<action>:<params>`).                                                                  |
| Sharding                      | `npm start` launches a `ShardingManager` with `TOTAL_SHARDS=auto`. Stats are collected from every shard with `broadcastEval`.                                                              |
| Safe startup                  | Checks the token and the Message Content intent before spawning, so a misconfigured bot does not crash-loop.                                                                               |
| Command system                | Categories (folder names), aliases, per-user cooldowns, user and bot permission checks, owner-only commands, autocomplete.                                                                 |
| Error handling                | Usage errors show the correct syntax. Unexpected errors are logged with the shard ID and answered politely.                                                                                |
| Slash command sync            | Sync on start (global or a single dev guild), or manually with `npm run deploy`.                                                                                                           |
| Hosting friendly              | Optional `PORT` health-check endpoint, graceful shutdown, minimal intents, cache limits and sweepers.                                                                                      |
| No extra runtime dependencies | Only `discord.js`. `.env` is loaded natively by Node.js.                                                                                                                                   |

## 📦 Commands

| Slash             | Prefix (default `!`)                         | Description                                                         |
| ----------------- | -------------------------------------------- | ------------------------------------------------------------------- |
| `/help [command]` | `!help`, `!h`, `!commands`, `!yardim`        | Interactive help with a category menu, or details for one command.  |
| `/ping`           | `!ping`, `!latency`, `!gecikme`              | WebSocket and API latency, shard info, **Refresh** button.          |
| `/avatar [user]`  | `!avatar`, `!av`, `!pp`, `!pfp`              | Global and server avatar with PNG / JPG / WEBP / GIF links.         |
| `/banner [user]`  | `!banner`, `!bnr`, `!afis`                   | Profile and server banner, or the profile accent color.             |
| `/stats`          | `!stats`, `!botinfo`, `!info`, `!istatistik` | Servers, members, memory and a per-shard breakdown from all shards. |

Mentioning the bot also works as a prefix: `@Bot ping`.

## 🚀 Quick start

**Requirements:** Node.js **20.12 or newer** (22 LTS recommended).

1. Create an application at the [Discord Developer Portal](https://discord.com/developers/applications). On the **Bot** tab:
   - Copy the token.
   - Enable **Message Content Intent** if you want prefix commands.
2. Invite the bot with the `bot` and `applications.commands` scopes. The `/stats` command also has an **Invite me** button.
3. Install and configure:

   ```bash
   git clone https://github.com/umutxyp/slash-command-bot.git
   cd slash-command-bot
   npm install
   cp .env.example .env   # then paste your token into DISCORD_TOKEN
   ```

4. Start the bot:

   ```bash
   npm start
   ```

| Script                            | What it does                                                                       |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| `npm start`                       | Production. Runs the sharding manager, syncs slash commands and spawns the shards. |
| `npm run dev`                     | Syncs commands and runs a single process without sharding (fine for small bots).   |
| `npm run deploy`                  | Syncs slash commands only.                                                         |
| `npm run lint` / `npm run format` | ESLint / Prettier.                                                                 |

## ⚙️ Configuration (`.env`)

| Variable          | Default                  | Description                                                                                 |
| ----------------- | ------------------------ | ------------------------------------------------------------------------------------------- |
| `DISCORD_TOKEN`   | —                        | **Required.** The bot token.                                                                |
| `PREFIX_ENABLED`  | `true`                   | Set to `false` for a slash-only bot. The Message Content intent is then not needed.         |
| `PREFIX`          | `!`                      | Prefix for message commands.                                                                |
| `OWNER_IDS`       | —                        | Comma-separated user IDs. Owners skip cooldowns and can use `ownerOnly` commands.           |
| `DEV_GUILD_ID`    | —                        | Register commands in this guild only, so updates show up instantly during development.      |
| `DEPLOY_ON_START` | `true`                   | Sync slash commands every time the bot starts.                                              |
| `TOTAL_SHARDS`    | `auto`                   | `auto` uses Discord's recommended count. You can also set a fixed number.                   |
| `BOT_STATUS`      | `Umut Bayraktar ♥ /help` | Custom status text.                                                                         |
| `ACCENT_COLOR`    | `#5865F2`                | Accent color of the Components V2 containers.                                               |
| `PORT`            | —                        | Serves a JSON health check at `/` (useful for Render, Railway, Replit and uptime monitors). |

## 🗂️ Project structure

```
src/
├── index.js                 # ShardingManager entry point (npm start)
├── bot.js                   # Code that runs in each shard process
├── deploy.js                # Slash command sync (npm run deploy)
├── config.js                # Reads and validates .env
├── commands/
│   ├── general/             # Folder name = category shown in /help
│   │   ├── help.js
│   │   └── ping.js
│   └── info/
│       ├── avatar.js
│       ├── banner.js
│       └── stats.js
├── events/                  # Loaded automatically: { name, once?, execute }
│   ├── clientReady.js
│   ├── interactionCreate.js # Slash commands, autocomplete, buttons, select menus
│   ├── messageCreate.js     # Prefix and mention commands
│   └── shardDisconnect.js   # Clear messages for unrecoverable gateway errors
├── structures/
│   ├── CommandContext.js        # One API for interactions and messages
│   ├── PrefixOptionResolver.js  # Turns "!cmd args" into typed slash-style options
│   └── UsageError.js
└── utils/                   # Loader, runner, logger, Components V2 helpers...
```

## 🧩 Writing a command

Create a file anywhere under `src/commands/<category>/`. It is loaded automatically, works as both a slash and a prefix command, and shows up in `/help`.

```js
'use strict';

const { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const ui = require('../../utils/ui');

/** @type {import('../../utils/loader').Command} */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Repeats your message.')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption((option) => option.setName('text').setDescription('What to say').setRequired(true)),

  aliases: ['echo'], // !say, !echo
  cooldown: 5, // seconds per user
  permissions: { user: [PermissionFlagsBits.ManageMessages] }, // also checked for prefix usage
  // prefix: false,   // slash only
  // slash: false,    // prefix only
  // ownerOnly: true, // OWNER_IDS only

  async execute(ctx) {
    // Same API for `/say text:hello` and `!say hello world`
    const text = ctx.options.getString('text', true);

    const container = ui.container().addTextDisplayComponents((t) => t.setContent(`### 💬 ${ctx.user.username} says\n${text}`));
    return ctx.reply(ui.payload([container]));
  },
};
```

**`ctx` API:** `ctx.options` (the same getters as `interaction.options`), `ctx.user`, `ctx.member`, `ctx.guild`, `ctx.channel`, `ctx.client`, `ctx.reply()`, `ctx.editReply()`, `ctx.deferReply()`, `ctx.isInteraction()`, `ctx.prefix`.

**Buttons and select menus:** give the component a custom ID such as `say:again:<userId>` and export `handleComponent(interaction, params)` from the same command. The ID is routed to that command with `params = ['again', '<userId>']`.

**Wrong arguments:** throw `new UsageError('message')`. The user sees the message together with the command's usage, which is generated from its options.

**Useful links:** [discord.js guide](https://discordjs.guide) · [Components V2 guide](https://discordjs.guide/popular-topics/display-components) · [Sharding guide](https://discordjs.guide/sharding/)

---

## 📜 License

MIT © [Umut Bayraktar](https://github.com/umutxyp)
