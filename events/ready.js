const client = require("../index");

client.on("ready", () => {
    console.log(`${client.user.tag} Bot Online!`)
    client.user.setActivity(`Umut Bayraktar ♥ Code Share`)
});
