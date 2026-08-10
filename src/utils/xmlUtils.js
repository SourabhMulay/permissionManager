function getLineEnding(content) {
    return content.includes('\r\n') ? '\r\n' : '\n';
}

function getIndentation(content, tagName) {
    const regex = new RegExp(`^(\\s*)<${tagName}>`, 'm');

    const match = content.match(regex);

    return match ? match[1] : '    ';
}

function escapeXml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

module.exports = {
    getLineEnding,
    getIndentation,
    escapeXml
};