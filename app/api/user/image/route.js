const { NextResponse } = require('next/server');
const { enqueueUpscale } = require('../../../../helper/midjourney');
const { userIdFromReq } = require('../../../../helper/userHelper');

async function POST(req, res) {
    const json = await req.json();
    const userId = await userIdFromReq(json);

    try { 
        console.log("Saving images");
        if (Array.isArray(json.choices) && json.choices?.length) {
            const choices = json.choices;
            console.log("Upscaling job");
            for (const choice of choices) {
                console.log(`upscaling: ${choice} ${json.imageId}`);
                await enqueueUpscale({ body: { imageId: json.imageId, choice, api_key: process.env.SELF_API_KEY }});
            }
        }

        // console.log("Queue Job", result);
        return NextResponse.json({ success: true });
    } catch(e) {
        console.error(`Error posting upload ${e.message} ${e.stack}`);
        return NextResponse.json({ success: false });
    }
}

module.exports = {
    POST
};