
const discordBaseUrl = 'https://api.discord.gg'
const serverId = process.env.SERVER_ID;
const channelId = process.env.DISCORD_CHANNEL_ID;


const getCommands = async() => {

    const searchParams = new URLSearchParams({
        type: "1",
        include_applications: "true",
    });
    const url = `${discordBaseUrl}/api/v9/channels/${this.config.ChannelId}/application-commands/search?${searchParams}`;
    const response = await this.config.fetch(url, {
        headers: { authorization: this.config.SalaiToken },
    });
    const data = await response.json();
    if (data?.application_commands) {
        data.application_commands.forEach((command) => {
            const name = getCommandName(command.name);
            if (name) {
                this.cache[name] = command;
            }
        });
    }
}

