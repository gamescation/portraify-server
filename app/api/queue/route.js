const { NextResponse } = require('next/server');
const { uploadToMidjourney, queueUploadToMidjourney } = require('../../../helper/midjourney');
const prisma = require('../../../lib/prisma');
const { UPLOAD_STATUS } = require('../../../constants/status');

const maxTries = 3;

async function requeueJob(userId, prompt, imageId, count) {
    const upload = await prisma.upload.findFirst({
        where: {
            userId,
            imageId
        },
        select: {
            id: true,
            status: true
        }
    })


    const parsedCount = (parseInt(count) || 0);
    const retrying = parsedCount < maxTries;

    if (upload?.status === UPLOAD_STATUS.QUEUED || upload?.status === UPLOAD_STATUS.PROCESSING) {
        await prisma.upload.update({
            where: {
                id: upload.id
            },
            data: {
                status: UPLOAD_STATUS.TIMED_OUT,
                active: true,
                retrying
            }
        })
    } else {
        console.log(`status is ${upload?.status}`);
    }

    
    if (retrying) { 
        console.log(`Count ${parsedCount} < ${maxTries}: retrying job`);
        await queueUploadToMidjourney(prompt, userId, imageId, parsedCount + 1)
    }
}

const TIMEOUT = 59000;

async function POST(req, res) {
    const json = await req.json();
    const { prompt, userId, imageId, api_key, count } = json;
    console.log("Uploading midjourney");

    if (api_key !== process.env.SELF_API_KEY) {
        return NextResponse.json({ success: false });
    }

    try { 
        const timeout = setTimeout(async() => {
            console.log("Timing out");
            await requeueJob(userId, prompt, imageId, count);
        }, TIMEOUT);

        await uploadToMidjourney({ prompt, userId, imageId });
        console.log("Job completed on time");
        clearTimeout(timeout);
        // console.log("Queue Job", result);
        return NextResponse.json({ success: true });
    } catch(e) {
        console.error(`Error posting upload ${e.message} ${e.stack}`);
        // requeue
        try {
            await requeueJob(userId, prompt, imageId, count);
        } catch (e) {
            console.error(`Could not requeue ${e.message} ${e.stack}`);
        }

        return NextResponse.json({ success: false });
    }
}

module.exports = {
    POST
};