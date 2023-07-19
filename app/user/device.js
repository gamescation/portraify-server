const prisma = require('../../lib/prisma');
const { generateToken, validateHash } = require('../../helper/encryption');
const { queryAI } = require('../../helper/ai');

// api/user/device

const getUniqueDeviceAndUser = (uniqueId, os) => {
    return prisma.device.findUnique({
        where: {
            uniqueId_os: {
                uniqueId,
                os
            }
        }
    })
}

module.exports = async (req, res) => {
    const { body } = req;

    console.log("Handling request for device token");
    if (body) {
        const { uniqueId, os, time, hash } = body;

        console.log("Validating hash");
        const validHash = await validateHash({ uniqueId, time, os, hash });
        try {
            if (uniqueId && hash && validHash) {
                await prisma.deviceTimes.create({ data: { uniqueId } })
                let device = await getUniqueDeviceAndUser(uniqueId);

                if (device) {
                    let { userId } = device;

                    console.log('Have device data: userId - ', userId);
                    const generatedToken = generateToken({ data: { uniqueId, userId, deviceId: device.id } });
                    console.log("Returning device", generatedToken);
                    return res.status(200).json({
                        // encrypted user token
                        t: generatedToken
                    });
                }

                console.log('No device, creating device with random username');
                // const query = `give me two random words that are family friendly with a rating of 10% adventurousness, 20% happy, 30% fun, 25% positive, 10% joyful, and 13% exciting, with the second word being a noun and the first word being an adjective, and make them one word - no explanation, just the words`;
                // const username = await queryAI(query);
                // console.log("Returned username: ", username);


                const newUser = await prisma.user.create({
                    data: {
                        name: username
                    }
                })
                device = await prisma.device.create({
                    data: {
                        uniqueId,
                        os,
                        userId: newUser.id
                    }
                })

                console.log("Device and user created");
                const generatedToken = generateToken({
                    data: {
                        uniqueId,
                        userId: newUser?.id,
                        deviceId: device?.id,
                        os
                    }
                });
                console.log("Generated token");
                return res.status(200).json({
                    // encrypted user token
                    t: generatedToken
                });
            }
        } catch (e) {
            console.error(`api/user/device: ${e.message} ${e.stack}`);
            return res.status(400).json({
                message: e.message
            });
        }
    }
    res.status(200).json({});
};