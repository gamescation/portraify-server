const { userIdFromReq } = require("../../../../helper/userHelper");
const { NextResponse } = require('next/server');
const prisma = require('../../../../lib/prisma');
const {queueUploadToMidjourney} = require('../../../../helper/midjourney');
const { logError } = require('../../../../helper/log');
const { UPLOAD_STATUS: STATUS } = require('../../../../constants/status');
const { decryptJwtBase64, encryptJwtBase64 } = require("../../../../helper/encryption");

const presetBackgroundInfo = {
    office: 'office background, high rise background, big window '
}

async function POST(req, res) {
    const json = await req.json();
    const userId = await userIdFromReq(json);
    console.log(`Post userId: ${userId}`);

    if (!userId) {
        return NextResponse.json({status: false});
    }

    try {
        const { imageId: encryptedImageId, data } = json;

        if (!encryptedImageId) {
            console.error('No image id');
            return  NextResponse.json({status: false, message: "No imageId"});
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
            return NextResponse.json({status: false});
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
                id: true
            }
        })
        
        if (upload) {
            console.log("Upload currently active, returning");
            return NextResponse.json({ status: true, upload: true })
        }

        const gender = data.gender ? `${data.gender}, `: ``;

        let background = data.background ? `${data.background} background, `: `office background, high rise background, big window background`;

        if (presetBackgroundInfo[background.toLowerCase()]) {
            background = presetBackgroundInfo[background.toLowerCase()];
        }

        const type = data.type ? `${data.type},`: `headshot, professional, `;

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
            return NextResponse.json({ status: false, message: "Could not find image" });
        }

        const { secure_url } = image;

        const prompt = `${secure_url} ${type} ${gender} ${background} soft, in focus, gentle lighting, younger, clear skin, youthful --v 5.2 --no distort --ar 9:16 --s 750`;
        await queueUploadToMidjourney(prompt, userId, image.id);

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
                imageId: image.id
            }
        })
        console.log("Upload created");

        return NextResponse.json({ status: true, uid: encryptJwtBase64({ data: { imageId: newUpload.id }})});
    } catch (error) {
        logError(error);
        return NextResponse.json({status: false});
    }
}

module.exports = {
    POST
};