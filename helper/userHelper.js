const { decryptJwtBase64 } = require("./encryption");

const userIdFromReq = async(data) => {
    const {t} = data;
    if (!t) {
        throw new Error("Unauthorized");
    }
    const auth = t.replace('Bearer ', '');
    const decryptedData = decryptJwtBase64(auth);
    const { userId } = decryptedData;
    if (!userId) {
        throw new Error("Unauthorized");
    }

    return userId;
}

module.exports = {
    userIdFromReq
}