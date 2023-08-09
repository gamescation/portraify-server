module.exports = {
    logError: (error) => {
        console.error(`Error: ${error.message} ${error.stack}`);
    }
}