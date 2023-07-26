const { NextResponse } = require('next/server');
const { generateToken, validateHash } = require('../../../../helper/encryption');
const prisma = require('../../../../lib/prisma');
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

module.exports = {
    POST: async (req) => {
        const body = await req.json();

        console.log("Handling request for device token");
        if (body) {
            const { uniqueId, os, time, hash } = body;

            console.log("Validating hash");
            const validHash = await validateHash({ uniqueId, time, os, hash });
            try {
                if (uniqueId && hash && validHash) {
                    console.log(`Creating device time`)
                    await prisma.deviceTimes.create({ data: { uniqueId } })
                    console.log("Device time created")

                    console.log("Getting user")
                    let device = await getUniqueDeviceAndUser(uniqueId, os);

                    if (device) {
                        let { userId } = device;

                        console.log('Have device data: userId - ', userId);
                        const generatedToken = generateToken({ data: { uniqueId, userId, deviceId: device.id } });
                        console.log("Returning device", generatedToken);
                        return NextResponse.json({
                            // encrypted user token
                            t: generatedToken
                        });
                    }
                    console.log("No User Found, Creating User")
                    const newUser = await prisma.user.create({
                        data: {
                            name: ''
                        }
                    });

                    console.log("Creating device")
                    device = await prisma.device.create({
                        data: {
                            uniqueId,
                            os,
                            userId: newUser.id
                        }
                    })

                    console.log("Device and user created");

                    console.log("Generating token");
                    const generatedToken = generateToken({
                        data: {
                            uniqueId,
                            userId: newUser?.id,
                            deviceId: device?.id,
                            os
                        }
                    });
                    console.log("Generated token");
                    return NextResponse.json({
                        // encrypted user token
                        t: generatedToken
                    });
                }
            } catch (e) {
                console.error(`api/user/device: ${e.message} ${e.stack}`);
                return NextResponse.json({
                    message: e.message
                });
            }
        }
        NextResponse.json({});
    }
};