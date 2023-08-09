const { Midjourney } = require('midjourney');
const axios = require('axios');
const { pushToPusher } = require('./pusher');
const { sha256, encryptJwtBase64 } = require('./encryption');
const prisma = require('../lib/prisma');
const cloudinary = require('../lib/cloudinary');

const uploadToMidjourney = async function (body) {
    console.log("Sending to midjourney");
    const { prompt, userId, imageId } = body;
    console.log("Processing: ", prompt, userId, imageId);
    const client = new Midjourney({
        ServerId: process.env.DISCORD_SERVER_ID,
        ChannelId: process.env.DISCORD_CHANNEL_ID,
        SalaiToken: process.env.DISCORD_AUTH,
        Debug: false,
        SessionId: sha256(userId),
        Ws: true, //enable ws is required for remix mode (and custom zoom)
    });
    await client.init();
    //imagine
    console.log("Imagining");
    let savedData = false;
    let newImage;
    let newUri;
    let updatedProgress;


    const timeout = setTimeout(async() => {
        console.log("55 seconds - about to timeout");

        if (updatedProgress < 100) {
            await enqueueUpdate({ body: { userId, imageId: newImage?.id, uri: newUri, api_key: process.env.SELF_API_KEY }});
        }
    }, 55000);

    console.log("Imagining: ", prompt);
    const result = await client.Imagine(
    prompt,
    async(uri, progress) => {
        //   console.log("loading", uri, "progress", progress);
            console.log("pushing to channel: ", sha256(userId), uri, progress);
            updatedProgress = progress;
            newUri = uri;
            pushToPusher(sha256(userId), `queued`, { secure_url: uri, progress });
        }
    ); 

    clearTimeout(timeout);
    console.log("Done Imagining: ", result.uri);
    updatedProgress = 100;

    const image = await prisma.image.findFirst({
        where: {
            id: imageId
        },
        select: {
            id: true,
            generatedImages: true
        }
    });

    const imageName = `${image.id}-${((new Date()).getTime())}`;
    const cloudUpload = await cloudinary.uploader.upload(result.uri, {
        access_mode: 'public',
        folder: 'ai',
        public_id: imageName
    })

    const secure_url = cloudUpload.secure_url;
    console.log("saving secure url: ", secure_url);

    await prisma.image.update({
        where: {
            id: image.id
        },
        data: {
            generatedImages: {
                ...image.generatedImages,
                [secure_url]: imageName 
            }
        }
    })

    newImage = await prisma.image.create({
        data: {
            userId,
            secure_url,
            generated: true,
            approved: false,
            data: {
                msgId: result.id,
                flags: result.flags,
                upscale: result.options?.filter(o => /^U/.test(o.label)).map((o) =>{
                    return o.custom;
                })
            }
        }
    })
    await pushToPusher(sha256(userId), `complete`, { secure_url, progress: 100, id: encryptJwtBase64({ data: { imageId: newImage.id } }) });
    console.log("Pushing complete: ", secure_url);
}

const upscale = async function({ customId, msgId, userId, flags }) {
    console.log("Upscaling with midjourney");
    const client = new Midjourney({
        ServerId: process.env.DISCORD_SERVER_ID,
        ChannelId: process.env.DISCORD_CHANNEL_ID,
        SalaiToken: process.env.DISCORD_AUTH,
        Debug: false,
        SessionId: sha256(userId),
        Ws: true, //enable ws is required for remix mode (and custom zoom)
    });
    await client.init();
    console.log("CustomId: ", customId);
    const result = await client.Custom({  msgId, customId, flags, hash: sha256(userId) })
    console.log("Upscaled image", result);
    return result;
}

const enqueue = async function({ body }) {
    console.log("Enqueuing");
    const target = "https://portraify-server.vercel.app/api/queue";
    const result =  await axios.post(`https://api.serverlessq.com?id=dd9ecf7e-136d-4c51-936c-9a106a9ef2c6&target=${encodeURIComponent(target)}`,
        body,
        {
            headers: {
                "x-api-key": process.env.SERVERLESSQ_API_TOKEN
            }
    })
    console.log("Enqueued");

    return result;
}

const enqueueUpdate = async function({ body }) {
    console.log("Enqueuing Update");
    const target = "https://portraify-server.vercel.app/api/queue/update";
    const result =  await axios.post(`https://api.serverlessq.com?id=dd9ecf7e-136d-4c51-936c-9a106a9ef2c6&target=${encodeURIComponent(target)}`,
        body,
        {
            headers: {
                "x-api-key": process.env.SERVERLESSQ_API_TOKEN
            }
    })
    console.log("Update Enqueued");

    return result;
}


const enqueueUpscale = async function({ body }) {
    console.log('Enqueuing Upscaling');
    const target = "https://portraify-server.vercel.app/api/queue/upscale";
    const result =  await axios.post(`https://api.serverlessq.com?id=dd9ecf7e-136d-4c51-936c-9a106a9ef2c6&target=${encodeURIComponent(target)}`,
        body,
        {
            headers: {
                "x-api-key": process.env.SERVERLESSQ_API_TOKEN
            }
    })
    console.log("Update Enqueued");

    return result;
}

const checkDiscord = async function({ messageId }) {
    const config = {
        headers: {
          Authorization: `Bearer ${process.env.DISCORD_AUTH}`,
          'Content-Type': 'application/json'
        }
      };
      
    const result = await axios.get(`https://discord.com/api/v9/channels/${process.env.DISCORD_CHANNEL_ID}/messages/${messageId}`, config)

    console.log(`Discord result: ${result.data}`)
    return result;
}

const checkMidjourney = async function(data) {
    console.log("Checking midjourney uri: ", data.uri);
    const spl = data.uri.split('/');
    const messageId = spl[spl.length - 1];
    console.log("Checking message ID: ", messageId);
    const result = await checkDiscord({ messageId });
    return result;
}


const queueUploadToMidjourney = async function(prompt, userId, imageId) {
    console.log("Queuing midjourney imageId: ", imageId);

    const result = await enqueue({ body: { prompt, userId, imageId, api_key: process.env.SELF_API_KEY }});

    console.log("Queued");

    return result;
}



module.exports = {
    uploadToMidjourney,
    queueUploadToMidjourney,
    checkMidjourney,
    upscale,
    enqueueUpdate,
    enqueueUpscale
}