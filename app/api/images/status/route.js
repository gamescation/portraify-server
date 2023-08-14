const { NextResponse } = require('next/server');
const prisma = require('../../../../lib/prisma');
const { UPLOAD_STATUS } = require('../../../../constants/status');
const { encryptJwtBase64, getIdFromEncryptedString } = require('../../../../helper/encryption');
const { userIdFromReq } = require('../../../../helper/userHelper');

async function POST(req, res) {
    const json = await req.json();
    const userId = await userIdFromReq(json);

    console.log("Checking upload status");
    try {
        const upload = await prisma.upload.findFirst({
            where: {
                userId,
                seen: false,
                imageId: getIdFromEncryptedString(json.imageId, 'imageId')
            }
        })

        console.log("Upload status and progress: ", upload?.status, upload?.progress)
        if (upload?.status === UPLOAD_STATUS.QUEUED || upload?.status === UPLOAD_STATUS.PROCESSING) {
            return NextResponse.json({ success: true, status: upload?.status, complete: false })
        } else if (upload?.status === UPLOAD_STATUS.COMPLETE) {
            console.log("This job is complete");
            const image = await prisma.image.findFirst({
                where: {
                    id: upload?.generatedImageId
                },
                select: {
                    id: true,
                    secure_url: true
                }
            })

            if (image?.secure_url) {
                console.log("Secure URL present");
                const { secure_url } = image;
                return NextResponse.json({ success: true, generating: false, complete: true, secure_url, id: encryptJwtBase64({ data: { imageId: image.id }}) });
            } 
            console.log("Secure URL not found");
        } else if (upload?.status === UPLOAD_STATUS.TIMED_OUT) {
            console.log("**** Upload timed out");
            return NextResponse.json({ success: true, status: UPLOAD_STATUS.TIMED_OUT, complete: false, retrying: upload.retrying })
        } else {
            console.log("Upload not found");
        }

        // console.log("Queue Job", result);
        return NextResponse.json({ success: true, generating: false, complete: false });
    } catch(e) {
        console.error(`Error checking upload status: ${e.message} ${e.stack}`);
        return NextResponse.json({ success: false });
    }
}

module.exports = {
    POST
};