const { NextResponse } = require('next/server');
const prisma = require('../../../../lib/prisma');

async function POST(req, res) {
    const json = await req.json();
    const userId = await userIdFromReq(json);

    console.log("Marking upload as seen");
    try {
        const upload = await prisma.upload.findFirst({
            where: {
                userId,
                active: true,
                seen: false
            },
            select: {
                id: true
            }
        })

        if (upload) {
            await prisma.upload.update({
                where: {
                    id: upload.id
                },
                data: {
                    active: false,
                    seen: true
                }
            })

            return NextResponse.json({ success: true, seen: true })
        }

        return NextResponse.json({ success: true, seen: false, active: false });
    } catch(e) {
        console.error(`Error posting update ${e.message} ${e.stack}`);
        return NextResponse.json({ success: false });
    }
}

module.exports = {
    POST
};