const { NextResponse } = require('next/server');
const { userIdFromReq } = require('../../../../helper/userHelper');
const prisma = require('../../../../lib/prisma');
const { imageReturnValues } = require('../../../../helper/returnValues');


async function POST(req, res) {
    const json = await req.json();
    const userId = await userIdFromReq(json);
    const { page = 1, pageSize = 10 } = json;

    console.log("Fetching images: ", page);
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
                generated: true,
                choices: true,
                createdAt: true
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
            return imageReturnValues(image)
        }) });
    } catch(e) {
        console.error(`Error posting upload ${e.message} ${e.stack}`);
        return NextResponse.json({ success: false });
    }
}

module.exports = {
    POST
};