const { encryptJwtBase64, decryptJwtBase64 } = require('./encryption');
const prisma = require('../lib/prisma');
const cloudinary = require('../lib/cloudinary');
const { Imagine, search, Upscale } = require('../lib/midjourney-lite');
const delay = require('../helper/delay');

const maxTries = 3;

async function handleMessage(message, userId, imageId, searchString) {
    if (message && message.attachments && message.attachments[0].url) {
        console.log("Handling message");
        const existingImage = await prisma.image.findFirst({
            where: {
                messageId: message.id
            },
            select: {
                id: true
            }
        })

        if (existingImage) {
            console.log("Existing image with messageId: ", message.id);
            return existingImage;
        }
        
        const imageName = `${imageId}-${((new Date()).getTime())}`;
        const imageUrl = message.attachments[0].url;
        const cloudUpload = await cloudinary.uploader.upload(imageUrl, {
            access_mode: 'public',
            folder: 'ai',
            public_id: imageName
        })
        const secure_url = cloudUpload.secure_url;

        const upscaleComponents = message.components?.map((component) => {
            return component.components;
        }).flat().filter(o => /^U/.test(o.label)).map((o) =>{
            return o.custom_id;
        });
        console.log("Creating image for messageId: ", message.id);
        return prisma.image.create({
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
                originalImageId: imageId,
                messageId: message.id,
                data: {
                    upscale: upscaleComponents,
                    searchString
                }
            }
        })
    }
}

async function findImages(searchString, userId, imageId, timeDelay = 30000) {
    await delay(timeDelay);
    const messages = await search(searchString);
    const images = [];

    if (messages?.length) {
        for(const message of messages) {
            const image = await handleMessage(message, userId, imageId, searchString);
            if (image) {
                console.log("Image created");
                images.push(image);
            }
        }
    } else {
        console.log("no messages");
    }
    return images;
}

const uploadToMidjourney = async function (body) {
    console.log("Sending to midjourney");
    const { prompt, userId, imageId } = body;
    console.log("Inputs: ", prompt, userId, imageId);

    console.log("Imagining: ", prompt);
    // const imagine = await Imagine(prompt);
    const searchString = `${encryptJwtBase64({ data: { imageId } })}-${(new Date()).getTime()}`;
    console.log("searchString: ", searchString);
    const promptWithData = `${prompt} --no ${searchString}`;
    await Imagine(promptWithData); 

    for (let i = 0; i < maxTries; i++) {
        let timeout = 29500;

        if (i > 0) {
            timeout = timeout / 2;
        }
    
        const images = await findImages(searchString, userId, imageId, timeout);
        if (images?.length) {
            return images[0];
        }
    }

}

const upscale = async function({ messageId, customId }) {
    // console.log("Upscaling with midjourney");
    const result = await Upscale(messageId, customId);
    return result.status === 204;
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

    return `${secure_url} ${type} ${gender} ${background} soft, in focus, gentle lighting, younger, clear skin, youthful --v 5.2 --iw 0.5 --no distort --ar 9:16 --s 750`;
}


const startUpload = async(json, userId) => {
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
    
    return uploadToMidjourney({ prompt, userId, imageId: image.id});
}



module.exports = {
    uploadToMidjourney,
    upscale,
    startUpload,
    generatePrompt
}