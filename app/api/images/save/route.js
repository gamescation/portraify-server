const { NextResponse } = require('next/server');
const prisma = require('../../../../lib/prisma');
const { encryptJwtBase64 } = require('../../../../helper/encryption');
const { userIdFromReq } = require('../../../../helper/userHelper');

async function POST(req, res) {
    const json = await req.json();
    const userId = await userIdFromReq(json);

    console.log("Saving image from user");
    try {
        const { secure_url } = json;
        console.log("Saving image: ", secure_url);
        const newImage =  await prisma.image.create({
            data: {
                user: {
                    connect: {
                        id: userId
                    }
                },
                secure_url,
                approved: true,
                uploaded: true,
            }
        })
        console.log("Saved: ", newImage.id);
        return NextResponse.json({ success: true, id: encryptJwtBase64({ data: { imageId: newImage.id }}) });
    } catch(e) {
        console.error(`Error posting update ${e.message} ${e.stack}`);
        return NextResponse.json({ success: false });
    }
}

module.exports = {
    POST
};