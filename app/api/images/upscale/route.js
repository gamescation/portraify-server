const { NextResponse } = require("next/server");
const prisma = require("../../../../lib/prisma");
const { upscale, upscaleWithMidjourney } = require("../../../../helper/midjourney");
const cloudinary = require('../../../../lib/cloudinary');
const { decryptJwtBase64 } = require("../../../../helper/encryption");
const { userIdFromReq } = require("../../../../helper/userHelper");
const { imageReturnValues } = require("../../../../helper/returnValues");
const { search } = require("../../../../lib/midjourney-lite");
const delay = require("../../../../helper/delay");
const { Midjourney } = require("midjourney");

const handleUpscaledImage = async(messageId, image, userId) => {
    const existingImage = await prisma.image.findFirst({
        where: {
            messageId,
            upscaled: true
        },
        select: {
            id: true,
            secure_url: true,
            generated: true,
            choices: true,
            createdAt: true
        }
    })

    if (existingImage) {
        console.log("Image exists for message");
        return existingImage;
    }
    
    const imageName = `${image.id}-${messageId}-gen-${(new Date()).getTime()}`;
    console.log(`Uploading to cloudinary`);
    const result = await cloudinary.uploader.upload(message.attachments[0].url, {
        access_mode: 'public',
        folder: 'upscaled',
        public_id: imageName
    })

    console.log("Uploaded image: ", result.secure_url);
    console.log("Creating image");

    return prisma.image.create({
        data: {
            user: {
                connect: {
                    id: userId
                }
            },
            secure_url: result.secure_url,
            generated: true,
            approved: true,
            upscaled: true,
            messageId
        }
    })
}

async function POST(req, res) {
    const json = await req.json();
    try {
        const userId = await userIdFromReq(json);
        const { imageId, choices } = json;
        console.log("Upscaling imageId: ", imageId);
        const decryptedData = decryptJwtBase64(imageId);
        const decryptedId = decryptedData.imageId;
        const image = await prisma.image.findFirst({
            where: {
                id: decryptedId,
            }
        })

        if (!image || image.userId !== userId) {
            console.log("Could not find image");
            return NextResponse.json({ success: false });
        }
        const messageId = image.messageId;
        // console.log("image data upscale: ", messageId, image.data?.upscale);
        let upscaledImages = false;
        
        if (!Array.isArray(choices) && !choices?.length) {
            // nothing to do
            return NextResponse.json({ success: true });
        }

        const images = [];
        for (const choice of choices) {
            const index = parseInt(choice) - 1;
            const customId = image.data?.upscale[index];
            console.log("upscaling: ", customId, messageId, choice);
            const result = await upscaleWithMidjourney({ msgId: messageId, userId, imageId, customId, choice, searchString: image.data?.searchString });
            console.log("Result.updatedImages: ", result.upscaledImages);
            images.push([...result.upscaledImages]);
        }

        // const newImages = [];
        // for(const image of images) {
        //     console.log("saving image: ", image);
        //     const newImage = await handleUpscaledImage(message, image, userId);
        //     newImages.push(newImage);
        // }

        // let needToDelay = false;
        // for (const choice of choices) {
        //     console.log("Choice: ", choice);
        //     try {
        //         const index = parseInt(choice) - 1;
        //         const customId = image.data?.upscale[index];

        //         if (customId) {
        //             console.log("upscaleWithMidjourney: ", messageId, customId, index);
        //             const result = await upscaleWithMidjourney({ msgId: messageId, userId, imageId, customId, choice });
        //             if (result) {
        //                 upscaledImages = result.upscaledImages;
        //                 needToDelay = true;
        //             }
        //         } 

        //     } catch(e) {
        //         console.log("failed to upscale: ", e.message, e.stack);
        //         upscaledImages = false;
        //     }
        // }

        // const images = [];
        // if (needToDelay  && upscaledImages && image.data.searchString) {
        //     await delay(13000);
        //     console.log("searching with searchString: ", image.data?.searchString);
        //     const messages = await search(image.data?.searchString);

        //     for(const message of messages) {
        //         try {
        //             console.log('Saving upscaled image');
        //             const newImage = await handleUpscaledImage(message, image, userId);
        //             if (newImage) {
        //                 console.log("Image upscaled: ", newImage.secure_url); 
        //                 images.push(newImage);
        //             }
        //         } catch(e) {
        //             console.error(`Error saving image: ${e.message} ${e.stack}`);
        //         }
        //     }
        // }
       

        return NextResponse.json({ 
            success: true, 
            images: images.map((image) => {
                return imageReturnValues(image);
            }) 
        });   
    } catch(e) {
        console.error(`Error posting upscale ${e.message} ${e.stack}`);
        return NextResponse.json({ success: false });
    }
}

module.exports = {
    POST
}