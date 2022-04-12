const Discord = require("discord.js");

exports.run = async (client, message, args) => {

    const embed = new Discord.MessageEmbed()
    .setTitle("Command Title")
    .setDescription("**https://discord.gg/6XGqdgE**")
    .setColor("BLUE")
    .setTimestamp()
    return message.channel.send({embeds : [embed]});

};
exports.conf = {
  aliases: []
};

exports.help = {
  name: "test"
};
