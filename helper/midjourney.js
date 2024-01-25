const { Midjourney } = require('midjourney');
const { encryptJwtBase64, decryptJwtBase64, sha256 } = require('./encryption');
const prisma = require('../lib/prisma');
const cloudinary = require('../lib/cloudinary');
const { Imagine, search, Upscale } = require('../lib/midjourney-lite');
const delay = require('../helper/delay');

const sessionId = "29e609c6d3dffed27997a5ea75d77ad1";

const maxTries = 3;

async function handleMessage(message, userId, imageId, searchString) {
    if (!message) {
        return;
    }
    if (message && message.attachments && message.attachments?.length && message.attachments[0] && message.attachments[0].url) {
        console.log("Handling message");
        const existingImage = await prisma.image.findFirst({
            where: {
                messageId: message.id
            },
            select: {
                id: true,
                secure_url: true,
                generated: true,
                choices: true,
                createdAt: true
            }
        })

        if (existingImage) {
            console.log("Existing image with messageId: ", message.id);
            return existingImage;
        }
        
        const imageName = `${imageId}-${((new Date()).getTime())}`;
        const imageUrl = message.attachments[0].url;
        let originalImageId = imageId;

        try {
            originalImageId = decryptJwtBase64(imageId)?.imageId?.toString();
        } catch(e) {
            console.error(`Could not decryptImageId: ${e.message}`);
            originalImageId = imageId.toString();
        }

        try { 
            const cloudUpload = await cloudinary.uploader.upload(imageUrl, {
                access_mode: 'public',
                folder: 'ai',
                public_id: imageName
            })
            const secure_url = cloudUpload.secure_url;

            const upscaleComponents = message.components?.map((component) => {
                return component.components;
            }).flat().filter(o => /^U/.test(o.label)).map((o) =>{
                return o.custom_id;
            });


            console.log("Creating image for messageId: ", message.id);
            return prisma.image.create({
                data: {
                    user: {
                        connect: {
                            id: userId
                        }
                    },
                    secure_url,
                    generated: true,
                    approved: false,
                    choices: true,
                    originalImageId,
                    messageId: message.id,
                    data: {
                        upscale: upscaleComponents,
                        searchString
                    }
                }
            })
        } catch (e) {
            console.error(`Could not upload: ${e.message} ${e.stack}`)
        }
    }
}

async function createImage(searchString, imageId, userId, result, upscaled = false) {
    const imageName = `${imageId}-${((new Date()).getTime())}`;
    const cloudUpload = await cloudinary.uploader.upload(result.uri, {
        access_mode: 'public',
        folder: 'ai',
        public_id: imageName
    })
    const secure_url = cloudUpload.secure_url;

    const upscaleComponents = !upscaled && result.options?.filter(o => /^U/.test(o.label)).map((o) =>{
        return o.custom;
    })

    console.log("Result: ", result);
    return prisma.image.create({
        data: {
            user: {
                connect: {
                    id: userId
                }
            },
            secure_url,
            generated: true,
            approved: false,
            choices: true,
            originalImageId: imageId.toString(),
            messageId: result.id,
            upscaled,
            data: {
                upscale: upscaled ? null: upscaleComponents,
                searchString
            }
        }
    })
}

async function findImages(searchString, userId, imageId) {
    const messages = await search(searchString);
    const images = [];

    if (messages?.length) {
        for(const message of messages) {
            const image = await handleMessage(message, userId, imageId, searchString);
            if (image) {
                console.log("Image created");
                images.push(image);
            }
        }
    } else {
        console.log("no messages");
    }
    return images;
}

const uploadToMidjourney = async function (body) {
    console.log("Sending to midjourney");
    const { prompt, userId, imageId } = body;
    console.log("Inputs: ", prompt, userId, imageId);

    console.log("Imagining: ", prompt);
    // const imagine = await Imagine(prompt);

    try {
        const client = new Midjourney({
            ServerId: process.env.DISCORD_SERVER_ID,
            ChannelId: process.env.DISCORD_CHANNEL_ID,
            SalaiToken: process.env.DISCORD_AUTH,
            Debug: false,
            SessionId: sessionId,
            Ws: true, //enable ws is required for remix mode (and custom zoom)
        });
        await client.init();
        console.log("client initialized");
        const result = await client.Imagine(prompt);
        console.log("Done Imagining: ", result.id, result?.uri);

        return createImage(prompt, imageId, userId, result);
    } catch(e) {
        console.error(`Error imagining: ${e.message} ${e.stack}`)
        throw Error("Error imagining");
        // try {
        //     await Imagine(promptWithData); 

        //     const images = await findImages(searchString, userId, imageId);
        //     if (images?.length) {
        //         return images[0];
        //     }
        // } catch(e) {
        //     console.error(`Error with midjourney: ${e.message} ${e.stack}`);
        // }
    }
}


const upscaleWithMidjourney = async function (body) {
    console.log("Sending to midjourney");
    const { msgId, userId, imageId, customId, choice, searchString } = body;
    console.log("Inputs: ", msgId, userId, imageId, customId, choice);
    const upscaledImages = [];
    try {
        const client = new Midjourney({
            ServerId: process.env.DISCORD_SERVER_ID,
            ChannelId: process.env.DISCORD_CHANNEL_ID,
            SalaiToken: process.env.DISCORD_AUTH,
            Debug: false,
            SessionId: sessionId,
            Ws: true, //enable ws is required for remix mode (and custom zoom)
        });
        await client.init();
        console.log("Upscaling job: ", choice, msgId, customId);
        const spl = customId.split('::');
        const hash = spl[spl.length - 1];
        console.log("hash: ", hash);
        const result = await client.Upscale({ index: choice, msgId, hash, flags: 0 });
        if (result) {
            console.log("ResultID: ", result.id);
            const newImage = await createImage(searchString, imageId, userId, result, true);
            upscaledImages.push(newImage);
        }
        // const result = await upscale({ customId, messageId: msgId });
        // if (result) {
        //     upscaledImages = true;
        //     needToDelay = true;
        // }
    } catch(e) {
        console.error(`Error upscaling image: ${e.message} ${e.stack}`);
        // const client = new Midjourney({
        //     ServerId: process.env.DISCORD_SERVER_ID,
        //     ChannelId: process.env.DISCORD_CHANNEL_ID,
        //     SalaiToken: process.env.DISCORD_AUTH,
        //     Debug: false,
        //     SessionId: sessionId,
        //     Ws: true, //enable ws is required for remix mode (and custom zoom)
        // });
        // await client.init();
        // console.log("Upscale job: ", choice, msgId);
        // const result = await client.Custom({ msgId,  customId, flags: 0 });
        // if (result) {
        //     upscaledImages = true;
        //     return createImage(image.data?.searchString, imageId, userId, result);
        // }
    }

    return {
        upscaledImages,
    }
}

const upscale = async function({ messageId, customId }) {
    // console.log("Upscaling with midjourney");
    const result = await Upscale(messageId, customId);
    return result.status === 204;
}

const presetBackgroundInfo = {
    "Office": 'office background, high rise background, big window ',
    "Forest": 'forest and trees in the background',
    "Waterfall": "enormous waterfall in the background",
    "New York City": "New York City scape New York Silhoette background", 
    "San Francisco": "San Francisco Golden Gate Bridge background", 
    "Hawaii": "Hawaii beach island background", 
    "Miami": "Miami beach sunny background",
    "Paris": "Eiffel Tower background, Paris setting background", 
    "Night Market": "Night Market background, food stalls, shopping",
    "Nature Landscape": "Landscape background with sweeping horizons and beautiful views",
    "Urban Cityscape": "City background, apartment buildings and basketball hoops with chains background",
    "Beach Sunset": "Beautiful Beach Sunset with the sun setting and ocean glimmering background",
    "Galaxy": "Use a galaxy in space for the background",
    "Abstract Patterns": "Create some abstract patterns inspired by modern art for the background",
    "Vintage Texture": "Texture the background like a 50s diner or a 60s drive in movie theater",
    "Watercolor Splash": "Watercolor background, water color splashes and staining backgroun",
    "Rustic Wood": "Rustic wood background, wood only, like in a cabin",
    "Minimalistic": "Minimalistic background, white background, nothing background, empty space background",
    "Floral Garden": "Garden background with many flowers, roses and daisies and tulips in the background",
    "Night Sky": "Night sky background where you can see the night sky and stars and comets and meteors background",
    "Underwater Scene": "Under water background, include Submarine, underwater, scuba diver, whales, dolphins, octopus",
    "Castle": "Castle background like in a movie or story, pricess castle background",
    "Industrial Setting": "Industrial background with steel beams and robotic arms",
    "Desert Dunes": "Desert dunes, sandy, sunny, dry background",
    "Tropical Paradise": "Tropical background, parrots, palm trees",
    "Sci-Fi Futuristic": "Robots and futuristic devices in the background"
}



const presetTypeInfo = {
    "Portrait": "portrait style photo",
    "Headshot": "headshot style photo",
    "Anime": "anime style photo, naruto, avatar the last airbender",
    "Graffiti": "graffiti in the background, restyle image as graffiti, tagging, spray paint style",
    "Street": "Ghettho imagery, dark, street life, thug life, gang",
    "Wild Life": "Animals, deer, alligator, crocodile, cow, bear, tiger, snake",
    "Food": "Hamburger, steak, lasagna, pasta, pizza, donut",
    "Travel": "Touristy, vacation style, relaxed",
    "Night Life": "Night Life clubbing, disco ball, cocktails, formal attire",
    "Abstract": "abstract art, simple colorful shapes on a white background, splatter",
    "Barbie": "Barbie style, change person into Barbie, try to use similar face as photo",
    "Photorealistic": "photo real version",
    "Realism": "Realism art, realistic textures and lifelike looking",
    "Impressionism": "Impressionism, like Monet with water lillies.  The entire image should look like a painting.",
    "Cubism": "Cubism, like one of Picassos paintings, the entire image should look like a painting",
    "Surrealism": "Surrealism, like a Salvador Dali painting, with staircases and melting watches and other weird objects.  entire image should look like a work of art.",
    "Minimalism": "Minimal, white background, no items",
    "Pop Art": "pop art style, like Campbell Soup Cans By Andy Worhol, the entire image should look like a painting",
    "Expressionism": "Expressionist art style, similar to Munch's Scream, the entire image should look like a painting",
    "Caricature": "Caricature style, simple lines, embellish features, artistic painting",
    "Noir": "Noir, Starry Night and detective movies (film noir) as inspiration.  Make the entire image black and white.",
    "Classic Portrait": "A classic portrait using the same face as the image",
    "Collage": "A collage of images combined into one art, perhaps with whales and stars and ducks and plants and bunnies and pandas",
    "Line Drawing": "Line drawing style, entire photo should been line drawn, simple lines, simple colors, water color",
    "Digital Painting": "Digital painting style - make the image look like it was draw in minecraft",
    "Monochromatic": "Black and white image style",
    "Mixed Media": "Television, record, poster, art, magic, fun, mixed media",
    "Pointillism": "Pointillism, many points, image should be many points, art style",
    "Photorealism": "Photoreal image, make this look like real life as close as possible",
    "Stylized": "Make this an artful image with random artists thrown in (Da Vinci, Dali, Michaelangelo)",
    "Mosaic": "Mosaic style, make a mixed pattern from this image",
    "UFO": "Add a UFO to the background of the image, a flying saucer ship",
    "Office": {
        "Food": 'pizza, cake',
    },
    "Forest": {
        "Food": 'picnic basket, tropical fruits',
    },
    // "Waterfall": "enormous waterfall in the background",
    // "New York City": "New York City scape New York Silhoette background", 
    // "San Francisco": "San Francisco Golden Gate Bridge background", 
    // "Hawaii": "Hawaii beach island background", 
    // "Miami": "Miami beach sunny background",
    "Paris": {
        "Food": "Baguette, croissant, brie, Eiffel tower"
    },
    // "Night Market": "Night Market background, food stalls, shopping",
    // "Nature Landscape": "Landscape background with sweeping horizons and beautiful views",
    // "Urban Cityscape": "City background, apartment buildings and basketball hoops with chains background",
    // "Beach Sunset": "Beautiful Beach Sunset with the sun setting and ocean glimmering background",
    // "Galaxy": "Use a galaxy in space for the background",
    // "Abstract Patterns": "Create some abstract patterns inspired by modern art for the background",
    // "Vintage Texture": "Texture the background like a 50s diner or a 60s drive in movie theater",
    // "Watercolor Splash": "Watercolor background, water color splashes and staining backgroun",
    // "Rustic Wood": "Rustic wood background, wood only, like in a cabin",
    // "Minimalistic": "Minimalistic background, white background, nothing background, empty space background",
    // "Floral Garden": "Garden background with many flowers, roses and daisies and tulips in the background",
    // "Night Sky": "Night sky background where you can see the night sky and stars and comets and meteors background",
    // "Underwater Scene": "Under water background, include Submarine, underwater, scuba diver, whales, dolphins, octopus",
    // "Castle": "Castle background like in a movie or story, pricess castle background",
    // "Industrial Setting": "Industrial background with steel beams and robotic arms",
    // "Desert Dunes": "Desert dunes, sandy, sunny, dry background",
    // "Tropical Paradise": "Tropical background, parrots, palm trees",
    // "Sci-Fi Futuristic": "Robots and futuristic devices in the background"
}

const  generatePrompt = (secure_url, data) => {
    const gender = data.gender ? `${data.gender}, `: ``;
    let type = data.type ? `${data.type},`: `headshot, professional, `;

    let background = data.background ? `${data.background} background, `: `office background, high rise background, big window background`;

    if (presetBackgroundInfo[data.background]) {
        background = presetBackgroundInfo[data.background];
    }

    if (presetTypeInfo[data.type]) {
        type = presetTypeInfo[data.type];
    }

    if (presetTypeInfo[data.background] && presetTypeInfo[data.background][data.type]) {
        type = `${type}, ${presetTypeInfo[data.background][data.type]}`;
    }
    return `Subject: ${secure_url} (use this photo as a reference) +
    Type of image: ${type} +
    Gender: ${gender} +
    Environment: ${background} +
    Phototype: photorealistic, editorial, medium-shot +
    Subject Focus: Sharp in-focus, foreground +
    Environment: slightly blurred +
    Camera: cinematic moment +
    Filmstock: captured on Kodak Ektachrome
    --v 6.0 --iw 0.25 --ar 9:16 --s 50`;
}


const startUpload = async(json, userId) => {
    const { imageId: encryptedImageId, data } = json;

    if (!encryptedImageId) {
        console.error('No image id');
        return  NextResponse.json({success: false, message: "No imageId"});
    }

    const decryptedImageId = decryptJwtBase64(encryptedImageId);
    const { imageId } = decryptedImageId;
    console.log("Decrypted image id: ", imageId);


    console.log("Finding user");
    const existingUser = await prisma.user.findFirst({
        where: {
            id: userId
        },
        select: {
            id: true,
        }
    });

    if (!existingUser) {
        console.error("Could not find user");
        return NextResponse.json({ success: false});
    }

    const image = await prisma.image.findFirst({
        where: {
            id: imageId
        },
        select: {
            id: true,
            secure_url: true
        }
    })

    if (!image) {
        throw new Image("Could not find image by imageId: ", imageId);
    }

    const { secure_url } = image;
    const prompt = generatePrompt(secure_url, data)
    
    console.log("uploading to MidJourney")
    return uploadToMidjourney({ prompt, userId, imageId: image.id });
}



module.exports = {
    uploadToMidjourney,
    upscale,
    startUpload,
    generatePrompt,
    findImages,
    upscaleWithMidjourney
}