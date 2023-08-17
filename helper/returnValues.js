const { encryptJwtBase64 } = require("./encryption")

const imageReturnValues = function(image) {
    return {
        secure_url: image.secure_url,
        id: encryptJwtBase64({ data: { imageId: image.id }}),
        generated: image.generated,
        choices: image.choices,
        createdAt: image.createdAt
    }
}

module.exports = {
    imageReturnValues
}