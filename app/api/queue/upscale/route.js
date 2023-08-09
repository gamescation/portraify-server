const { NextResponse } = require("next/server");
const prisma = require("../../../../lib/prisma");
const { upscale } = require("../../../../helper/midjourney");
const cloudinary = require('../../../../lib/cloudinary');
const { pushToPusher } = require("../../../../helper/pusher");
const { sha256, decryptJwtBase64, encryptJwtBase64 } = require("../../../../helper/encryption");

async function POST(req, res) {
    const json = await req.json();
    console.log("Upscaling");

    if (json.api_key !== process.env.SELF_API_KEY) {
        return NextResponse.json({ success: false });
    }

    try {
        const { imageId } = json;
        const decryptedData = decryptJwtBase64(imageId);
        const decryptedId = decryptedData.imageId;
        const image = await prisma.image.findFirst({
            where: {
                id: decryptedId,
            }
        })

        if (!image) {
            console.log("Could not find image");
            return NextResponse.json({ success: false });
        }
        const { choice } = json;
        const {userId} = image;
        const msgId = image.data?.msgId;
        const customId = image.data?.upscale[choice - 1];
        console.log("CustomId and choice: ", customId, choice, choice - 1);
        const upscaledImage = await upscale({ customId, msgId, userId, flags: image.data?.flags });
        const imageName = `${image.id}-${msgId}-${upscaledImage.id}-${choice}`;
        console.log(`Uploading to cloudinary`);
        const result = await cloudinary.uploader.upload(upscaledImage.uri, {
            access_mode: 'public',
            folder: 'upscaled',
            public_id: imageName
        })
        console.log("Uploaded image: ", result.secure_url);
        console.log("Creating image");
        const newImage = await prisma.image.create({
            data: {
                userId,
                secure_url: result.secure_url,
                generated: true,
                approved: true,
                data: {
                    msgId,
                    choice
                }
            }
        })
        console.log("Image created", newImage.id); 
        await pushToPusher(sha256(userId), `upscaled`, { secure_url: result.secure_url, id: encryptJwtBase64({ data: { imageId: newImage.id } }) });
        return NextResponse.json({ success: true });   
    } catch(e) {
        console.error(`Error posting upload ${e.message} ${e.stack}`);
        return NextResponse.json({ success: false });
    }
}

module.exports = {
    POST
};