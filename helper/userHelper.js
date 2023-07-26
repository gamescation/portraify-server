const { decryptJwtBase64 } = require("./encryption");

const userIdFromReq = (req) => {
    const auth = req.headers['authorization'];
    console.log(`auth: ${auth}`);
    if (!auth) {
        throw new Error("Unauthorized");
    }

    const data = decryptJwtBase64(auth.replace('Bearer ', ''));
    const { userId } = data;
    if (!userId) {
        throw new Error("Unauthorized");
    }

    return userId;
}

module.exports = {
    userIdFromReq
}