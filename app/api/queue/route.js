const { NextResponse } = require('next/server');
const { uploadToMidjourney } = require('../../../helper/midjourney');

async function POST(req, res) {
    const json = await req.json();
    const { prompt, userId, api_key } = json;
    console.log("Uploading midjourney");

    if (api_key !== process.env.SELF_API_KEY) {
        return NextResponse.json({ success: false });
    }

    try { 
        await uploadToMidjourney({ prompt, userId });
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