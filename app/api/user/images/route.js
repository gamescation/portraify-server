const { NextResponse } = require('next/server');
const { userIdFromReq } = require('../../../../helper/userHelper');
const prisma = require('../../../../lib/prisma');
const { encryptJwtBase64, sha256 } = require('../../../../helper/encryption');

const returnValues = function(image) {
    return {
        secure_url: image.secure_url,
        id: encryptJwtBase64({ data: { imageId: image.id }}),
        generated: image.generated
    }
}

async function POST(req, res) {
    const json = await req.json();
    const userId = await userIdFromReq(json);
    const { page = 1, pageSize = 10 } = json;

    console.log("Fetching images");
    try { 
        const images = await prisma.image.findMany({
            where: {
                userId,
                deleted: false,
                archived: false,
            },
            skip: (page - 1) * pageSize,
            take: parseInt(pageSize),
            select: {
                secure_url: true,
                id: true,
                generated: true
            },
            orderBy: {
                createdAt: 'desc' 
            }
        })

        if (!images?.length) {
            // console.log("Could not find images");
            return NextResponse.json({ success: true, images: [] });
        }

        return NextResponse.json({ success: true, images: images.map((image) => {
            return returnValues(image)
        }), channel_id: sha256(userId) });
    } catch(e) {
        console.error(`Error posting upload ${e.message} ${e.stack}`);
        return NextResponse.json({ success: false });
    }
}

module.exports = {
    POST
};