const { NextResponse } = require('next/server');
const prisma = require('../../../../lib/prisma');
const { UPLOAD_STATUS } = require('../../../../constants/status');
const { userIdFromReq } = require('../../../../helper/userHelper');
const { checkDiscord, findImages } = require('../../../../helper/midjourney');
const { imageReturnValues } = require('../../../../helper/returnValues');

async function POST(req, res) {
    const json = await req.json();
    const userId = await userIdFromReq(json);
    console.log("Checking upload status");
    try {
        const { imageId, searchString } = json;
        const images = await findImages(searchString, userId, imageId);

        return NextResponse.json({ success: true, image: images?.length ? imageReturnValues(images[0]): undefined});
    } catch (e) {
        return NextResponse.json({ success: false });
    }
}

module.exports = {
    POST
};