const { Client, MessageEmbed } = require("discord.js");
const config = require("./config.json");
const token = config.token;

const client = new Client({
intents: 32767
});
module.exports = client;

require("./events/message.js")
require("./events/ready.js")
client.login(token); 
