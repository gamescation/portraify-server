const { NextResponse } = require('next/server');
const prisma = require('../../../../lib/prisma');
const { UPLOAD_STATUS } = require('../../../../constants/status');
const { encryptJwtBase64, getIdFromEncryptedString } = require('../../../../helper/encryption');
const { userIdFromReq } = require('../../../../helper/userHelper');
const { checkDiscord, generatePrompt, uploadToMidjourney } = require('../../../../helper/midjourney');

const getMessageIdFromUrl = (uri) => {
    const spl = uri.split('/');
    return spl[spl.length - 1];
}

async function POST(req, res) {
    return NextResponse.json({ success: false });
    // const json = await req.json();
    // const userId = await userIdFromReq(json);

    // console.log("Checking upload status");
    // try {
    //     const retryUpload = async(upload) => {
    //         // queued, or not? lets just upload now in case
    //         const result = await uploadToMidjourney(upload);
    //         return result;
    //     }
    //     const upload = await prisma.upload.findFirst({
    //         where: {
    //             userId,
    //             imageId: getIdFromEncryptedString(json.imageId, 'imageId')
    //         }
    //     })

    //     console.log("Upload status and progress: ", upload?.prompt, upload?.status, upload?.uri, upload?.progress, upload?.prompt);
    //     if (!upload) {
    //         console.log("Recreating");
    //         const prompt = generatePrompt(secure_url, data)
    //         const result = await uploadToMidjourney({ prompt, userId, imageId: upload.imageId });
    //         return NextResponse.json({ success: true, status: "COMPLETE", complete: true, secure_url: result.secure_url, id: encryptJwtBase64({ data: { imageId: result.id }}), generated: true })
    //     }


    //     if (upload?.status === UPLOAD_STATUS.QUEUED) {
    //         console.log("Queued");
    //         // const result = await retryUpload(upload);
    //         return NextResponse.json({ success: true, status: "QUEUED", complete: false })
    //     }
        
    //     if (upload?.status === UPLOAD_STATUS.PROCESSING) {
    //         if (upload.uri) {
    //             const messageId = getMessageIdFromUrl(upload.uri);
    //             const discord = await checkDiscord({ messageId });

    //             console.log("discord message: ", discord);

    //             return NextResponse.json({ success: true, status: upload?.status, complete: false })
    //         } else {
    //             const result = await retryUpload(upload);
    //             return NextResponse.json({ success: true, status: "COMPLETE", complete: true, secure_url: result.secure_url, id: encryptJwtBase64({ data: { imageId: result.id }}), generated: true })
    //         }
    //     } else if (upload?.status === UPLOAD_STATUS.COMPLETE) {
    //         console.log("This job is complete");
    //         const image = await prisma.image.findFirst({
    //             where: {
    //                 id: upload?.generatedImageId
    //             },
    //             select: {
    //                 id: true,
    //                 secure_url: true
    //             }
    //         })

    //         const { secure_url } = image;
    //         return NextResponse.json({ success: true, generating: false, complete: true, secure_url, id: encryptJwtBase64({ data: { imageId: image.id }}) });
    //     } else {
    //         console.log("Upload not found");
    //         const result = await retryUpload(upload);
    //         return NextResponse.json({ success: true, status: "COMPLETE", complete: true, secure_url: result.secure_url, id: encryptJwtBase64({ data: { imageId: result.id }}), generated: true })
    //     }
    // } catch(e) {
    //     console.error(`Error checking upload status: ${e.message} ${e.stack}`);
    //     return NextResponse.json({ success: false });
    // }
}

module.exports = {
    POST
};