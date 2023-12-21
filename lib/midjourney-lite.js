const fetch = require('node-fetch');
const { nextNonce } = require('./nonce');
const delay = require('../helper/delay');
const discordBaseUrl = 'https://discord.com'
const channelId = process.env.DISCORD_CHANNEL_ID;
const token = process.env.DISCORD_AUTH;
const guildId = process.env.DISCORD_GUILD_ID;
const sessionId = "29e609c6d3dffed27997a5ea75d77ad1";
const MIDJOURNEY_BOT_ID = '936929561302675456';
const USER_ID = '714213530970226718'

async function getCommand(name) {
    const searchParams = new URLSearchParams({
        type: "1",
        query: name,
        limit: "1",
        include_applications: "true",
    });
    const url = `${discordBaseUrl}/api/v9/channels/${channelId}/application-commands/search?${searchParams}`;
    const response = await fetch(url, {
        headers: { authorization: token },
    });
    const data = await response.json();
    if (data?.application_commands?.[0]) {
        return data.application_commands[0];
    }
}

async function commandData(
    name,
    options = [],
    attachments = []
  ) {
    const command = await getCommand(name);
    const data = {
      version: command.version,
      id: command.id,
      name: command.name,
      type: command.type,
      options,
      application_command: command,
      attachments,
    };
    return data;
  }
async function dataToPayload(data, nonce) {
    const payload = {
        type: 2,
        application_id: data.application_command.application_id,
        guild_id: guildId,
        channel_id: channelId,
        session_id: sessionId,
        data,
        nonce,
    };
    return payload;
}


async function imaginePayload(prompt, nonce) {
    const data = await commandData("imagine", [
        {
        type: 3,
        name: "prompt",
        value: prompt,
        },
    ]);
    return dataToPayload(data, nonce);
}

const interact = async (payload) => {
    try {
        const body = JSON.stringify(payload);
        const headers = {
            "Content-Type": "application/json",
            Authorization: token,
            "Content-Length": body.length
        };

        const interactionResult = await fetch(
            `${discordBaseUrl}/api/v9/interactions`,
            {
                method: "POST",
                body,
                headers,
            }
        );
        return interactionResult;
    }
    catch (error) {
        console.error(`Failed interaction: ${error.message} ${error.stack}`);
    }
}

const Imagine = async(prompt) => {
    const payload = await imaginePayload(prompt, nextNonce());
    await interact(payload);
}


const search = async(searchString) => {
    const url = `${discordBaseUrl}/api/v9/channels/${channelId}/messages?limit=50`;
    const response = await fetch(url, {
        headers: { authorization: token },
    });
    const data = await response.json();

    const posts = data.filter((value) => {
        if (value.mentions?.length > 0 && value.mentions[0].id === USER_ID && value.author.id === MIDJOURNEY_BOT_ID) {
            return value.content.indexOf(searchString) > 0;
        }
    })

    console.log("found posts: ", posts.length);

    return posts;
}

const Upscale = async(message_id, customId, nonce = nextNonce()) => {
    const payload = {
        type: 3,
        nonce,
        application_id: MIDJOURNEY_BOT_ID,
        channel_id: channelId,
        session_id: sessionId,
        guild_id: guildId,
        message_flags: 0,
        message_id,
        data: {
            component_type: 2,
            custom_id: customId
        }
    };
    // console.log("Payload: ", payload);
    const result = await interact(payload);
    // console.log("result: ", result);
    return result;
}



module.exports = {
    Imagine,
    search,
    Upscale
}
