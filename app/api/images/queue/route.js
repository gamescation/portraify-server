const { userIdFromReq } = require("../../../../helper/userHelper");
const { NextResponse } = require('next/server');
const prisma = require('../../../../lib/prisma');
const {queueUpload} = require('../../../../helper/midjourney');
const { logError } = require('../../../../helper/log');


async function POST(req, res) {
    const json = await req.json();
    const userId = await userIdFromReq(json);
    console.log(`Post userId: ${userId}`);

    if (!userId) {
        return NextResponse.json({success: false});
    }

    try {
        const { newUpload } = await queueUpload(json, userId);


        return NextResponse.json({ success: true, uid: encryptJwtBase64({ data: { imageId: newUpload.id }})});
    } catch (error) {
        logError(error);
        return NextResponse.json({success: false});
    }
}

module.exports = {
    POST
};