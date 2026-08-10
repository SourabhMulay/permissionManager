const fs = require('fs').promises;
const path = require('path');

async function getPermissionFiles(folderPath) {
    const entries = await fs.readdir(folderPath, {
        withFileTypes: true
    });

    return entries
        .filter(entry => {
            return (
                entry.isFile() &&
                (
                    entry.name.endsWith('.permissionset-meta.xml') ||
                    entry.name.endsWith('.profile-meta.xml')
                )
            );
        })
        .map(entry => path.join(folderPath, entry.name));
}

async function readFile(filePath) {
    return fs.readFile(filePath, 'utf8');
}

async function writeFile(filePath, content) {
    await fs.writeFile(filePath, content, 'utf8');
}

module.exports = {
    getPermissionFiles,
    readFile,
    writeFile
};