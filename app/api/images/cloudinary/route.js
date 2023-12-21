const cloudinary = require('../../../../lib/cloudinary');
const { userIdFromReq } = require("../../../../helper/userHelper");
const { NextResponse } = require('next/server');
const { sha256 } = require('../../../../helper/encryption');

async function POST(req, res) {
    const json = await req.json();
    const userId = await userIdFromReq(json);
    console.log(`Post userId: ${userId}`);

    if (!userId) {
        return NextResponse.json({success: false});
    }

    const timestamp = Math.round(new Date().getTime() / 1000);
    const public_id = `${sha256(userId)}-${timestamp}`;
    const signature = cloudinary.utils.api_sign_request(
        { timestamp, folder: 'user', public_id, upload_preset: 'default' }, // Replace 'your_folder' with your desired folder in Cloudinary
        process.env.CLOUDINARY_API_SECRET
    );
    console.log("Returning signature");
    return NextResponse.json({ success: true, signature, timestamp, public_id, channel_id: sha256(userId), 
        cloudinary_api_key: process.env.CLOUDINARY_API_KEY, 
        cloudinary_cloudname: process.env.CLOUDINARY_CLOUD_NAME 
    });
}

module.exports = {
    POST
};