const cloudinary = require('../../../lib/cloudinary');
const { userIdFromReq } = require("../../../helper/userHelper");
const { NextResponse } = require('next/server');

module.exports = {
    POST(req) {
        console.log(`Handling cloudinary post: ${req.headers}`);
        const userId = userIdFromReq(req);
        console.log(`UserId: ${userId}`);

        if (!userId) {
            return NextResponse.json({
                success: false,
                message: "Failed check"
            });
        }

        const timestamp = Math.round(new Date().getTime() / 1000);
        const signature = cloudinary.utils.api_sign_request(
            { timestamp, folder: 'user' }, // Replace 'your_folder' with your desired folder in Cloudinary
            process.env.CLOUDINARY_API_SECRET
        );
        console.log(`returning signature: ${signature} and userId ${userId}`);
        NextResponse.json({ signature, timestamp, userId });
    }
}