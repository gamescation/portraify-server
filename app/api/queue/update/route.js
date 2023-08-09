const { NextResponse } = require('next/server');
const { checkMidjourney } = require('../../../../helper/midjourney');

async function POST(req, res) {
    const json = await req.json();
    console.log("Checking Updates");

    if (json.api_key !== process.env.SELF_API_KEY) {
        return NextResponse.json({ success: false });
    }

    try {
        await checkMidjourney(json);
        // console.log("Queue Job", result);
        return NextResponse.json({ success: true });
    } catch(e) {
        console.error(`Error posting update ${e.message} ${e.stack}`);
        return NextResponse.json({ success: false });
    }
}

module.exports = {
    POST
};