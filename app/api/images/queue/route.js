const { userIdFromReq } = require("../../../../helper/userHelper");
const { NextResponse } = require('next/server');
const prisma = require('../../../../lib/prisma');
const {startUpload} = require('../../../../helper/midjourney');
const { logError } = require('../../../../helper/log');
const { encryptJwtBase64 } = require("../../../../helper/encryption");
const { imageReturnValues } = require("../../../../helper/returnValues");

async function POST(req, res) {
    const json = await req.json();
    const userId = await userIdFromReq(json);
    console.log(`Post userId: ${userId}`);
    if (!userId) {
        return NextResponse.json({success: false});
    }

    try {
        const image = await startUpload(json, userId);
        console.log("image uploaded: ", image);
        return NextResponse.json({ success: true, image: image && imageReturnValues(image) });
    } catch (error) {
        logError(error);
        return NextResponse.json({success: false});
    }
}

module.exports = {
    POST
};