const cloudinary = require('../../../../lib/cloudinary');
const { userIdFromReq } = require("../../../../helper/userHelper");
const { NextResponse } = require('next/server');
const prisma = require('../../../../lib/prisma');
const {queueUploadToMidjourney} = require('../../../../helper/midjourney');
const { logError } = require('../../../../helper/log');
const { sha256 } = require('../../../../helper/encryption');

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
        const { secure_url, data } = json;
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
        // console.log("Updating with secure_url: ", secure_url);
        // await prisma.user.update({
        //     where: {
        //         id: existingUser.id
        //     },
        //     data: {
        //         images: {
        //             ...existingUser.images,
        //             uploaded: {
        //                 ...existingUser.images?.uploaded,
        //                 [Math.floor((new Date()).getTime()/1000)]: secure_url
        //             }
        //         }
        //     }
        // })

        const image = await prisma.image.create({
            data: {
                userId,
                secure_url,
                approved: true,
                uploaded: true,
                data
            }
        })
        const gender = data.gender ? `${data.gender}, `: ``;

        let background = data.background ? `${data.background} background, `: `office background, high rise background, big window background`;

        if (presetBackgroundInfo[background.toLowerCase()]) {
            background = presetBackgroundInfo[background.toLowerCase()];
        }

        const type = data.type ? `${data.type},`: `headshot, professional, `;

        const prompt = `${secure_url} ${type} ${gender} ${background} soft, in focus, gentle lighting, younger, clear skin, youthful --v 5.2 --no distort --iw 1 --ar 9:16 --s 550`;
        await queueUploadToMidjourney(prompt, userId, image.id);

        return NextResponse.json({ status: true });
    } catch (error) {
        logError(error);
        return NextResponse.json({status: false});
    }
}

module.exports = {
    POST
};