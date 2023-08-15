const { Midjourney } = require('midjourney');
const axios = require('axios');
const { pushToPusher } = require('./pusher');
const { sha256, encryptJwtBase64, decryptJwtBase64 } = require('./encryption');
const prisma = require('../lib/edge-prisma');
const cloudinary = require('../lib/cloudinary');
const { UPLOAD_STATUS: STATUS } = require('../constants/status');

const uploadToMidjourney = async function (body) {
    console.log("Sending to midjourney");
    const { prompt, userId, imageId } = body;
    console.log("Processing: ", prompt, userId, imageId);
    // initializes midjourney
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
    let newImage;

    console.log("Imagining: ", prompt);

    const upload = await prisma.upload.findFirst({
        where: {
            userId,
            imageId,
            active: true
        },
        select: { 
            id: true
        }
    })

    if (upload) {
        console.log('Found Upload - saving status as processing');
        await prisma.upload.update({
            where: {
                id: upload.id
            },
            data: {
                status:  STATUS.PROCESSING
            }
        });
    }


    console.log("Going to imagine");
    let updatedProgress = 0;
    const result = await client.Imagine(
    prompt,
    async(uri, progress) => {
            console.log("pushing to channel: ", sha256(userId), uri, progress);
            updatedProgress = progress;
            await pushToPusher(sha256(userId), `queued`, { secure_url: uri, progress });

            if (upload) {
                console.log("Updating upload: ", uri);
                await prisma.upload.update({
                    where: {
                        id: upload.id
                    },
                    data: {
                        progress,
                        uri: uri
                    }
                })
            }
        }
    ); 
    console.log("Done Imagining: ", result.uri);
    updatedProgress = '100%';
    
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
            user: {
                connect: {
                    id: userId
                }
            },
            secure_url,
            generated: true,
            approved: false,
            choices: true,
            data: {
                msgId: result.id,
                flags: result.flags,
                upscale: result.options?.filter(o => /^U/.test(o.label)).map((o) =>{
                    return o.custom;
                })
            }
        }
    })

    if (upload) {
        console.log("Marking complete")
        await prisma.upload.update({
            where: {
                id: upload.id
            },
            data: {
                uri: secure_url,
                generatedImageId: newImage.id,
                status: STATUS.COMPLETE,
                completedAt: new Date(),
                active: false,
                progress: "100%"
            }
        })
    }
    await pushToPusher(sha256(userId), `complete`, { secure_url, progress: 100, id: encryptJwtBase64({ data: { imageId: newImage.id } }) });
    console.log("Pushing complete: ", secure_url);

    return newImage;
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


const queueUploadToMidjourney = async function(prompt, userId, imageId, count = 0) {
    console.log("Queuing midjourney imageId: ", imageId);

    const result = await enqueue({ body: { prompt, userId, imageId, api_key: process.env.SELF_API_KEY, count}});

    console.log("Queued");

    return result;
}

const presetBackgroundInfo = {
    office: 'office background, high rise background, big window '
}

const generatePrompt = (secure_url, data) => {
    const gender = data.gender ? `${data.gender}, `: ``;

    let background = data.background ? `${data.background} background, `: `office background, high rise background, big window background`;

    if (presetBackgroundInfo[background.toLowerCase()]) {
        background = presetBackgroundInfo[background.toLowerCase()];
    }

    const type = data.type ? `${data.type},`: `headshot, professional, `;

    return `${secure_url} ${type} ${gender} ${background} soft, in focus, gentle lighting, younger, clear skin, youthful --v 5.2 --no distort --ar 9:16 --s 750`;
}


const queueUpload = async(json, userId) => {
    const { imageId: encryptedImageId, data } = json;

    if (!encryptedImageId) {
        console.error('No image id');
        return  NextResponse.json({success: false, message: "No imageId"});
    }

    const decryptedImageId = decryptJwtBase64(encryptedImageId);
    const { imageId } = decryptedImageId;
    console.log("Decrypted image id: ", imageId);


    console.log("Finding user");
    const existingUser = await prisma.user.findFirst({
        where: {
            id: userId
        },
        select: {
            id: true,
        }
    });

    if (!existingUser) {
        console.error("Could not find user");
        return NextResponse.json({ success: false});
    }

    console.log("Found user");
    console.log("Looking for upload");
    const upload = await prisma.upload.findFirst({
        where: {
            userId,
            imageId,
            active: true,
        },
        select: {
            id: true,

        }
    })
    
    if (upload) {
        console.log("Upload currently active - WRITE CODE TO check discord");
        // if (upload.uri) 
        // const result = await checkDiscord({ messageId: upload.uri});
    }

    const image = await prisma.image.findFirst({
        where: {
            id: imageId
        },
        select: {
            id: true,
            secure_url: true
        }
    })

    if (!image) {
        return NextResponse.json({ success: false, message: "Could not find image" });
    }

    const { secure_url } = image;
    const prompt = generatePrompt(secure_url, data)
    console.log("Creating upload")
    const newUpload = await prisma.upload.create({
        data: {
            user: {
                connect: {
                    id: userId
                }
            },
            active: true,
            status: STATUS.QUEUED,
            imageId: image.id,
            prompt
        }
    })
    console.log("Upload created");
    
    await queueUploadToMidjourney(prompt, userId, image.id);
    return { image, newUpload };
}



module.exports = {
    uploadToMidjourney,
    queueUploadToMidjourney,
    checkMidjourney,
    upscale,
    enqueueUpdate,
    enqueueUpscale,
    checkDiscord,
    queueUpload,
    generatePrompt
}