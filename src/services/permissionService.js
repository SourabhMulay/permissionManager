const {
    getLineEnding,
    getIndentation,
    escapeXml
} = require('../utils/xmlUtils');


function updateFieldPermission(content, permission) {

    const lineEnding = getLineEnding(content);

    const fieldPermissionsRegex =
        /<fieldPermissions>([\s\S]*?)<\/fieldPermissions>/g;

    let found = false;

    /*
     * First check whether the exact field already exists.
     * If it does, update its readable/editable values.
     */
    const updatedContent = content.replace(
        fieldPermissionsRegex,
        (fullBlock, body) => {

            const fieldMatch = body.match(
                /<field>([\s\S]*?)<\/field>/
            );

            if (!fieldMatch) {
                return fullBlock;
            }

            const existingField =
                fieldMatch[1].trim();

            if (existingField !== permission.field) {
                return fullBlock;
            }

            found = true;

            return updateExistingFieldPermission(
                fullBlock,
                permission
            );
        }
    );

    /*
     * Exact field already exists.
     */
    if (found) {
        return updatedContent;
    }

    /*
     * Field does not exist.
     * Add it in the correct object section.
     */
    return addFieldPermission(
        content,
        permission,
        lineEnding
    );
}


function updateExistingFieldPermission(
    block,
    permission
) {

    let result = block;

    result = result.replace(
        /<readable>(true|false)<\/readable>/,
        `<readable>${permission.readable}</readable>`
    );

    result = result.replace(
        /<editable>(true|false)<\/editable>/,
        `<editable>${permission.editable}</editable>`
    );

    return result;
}


function addFieldPermission(
    content,
    permission,
    lineEnding
) {

    const blockIndent =
        getIndentation(
            content,
            'fieldPermissions'
        );

    const childIndent =
        blockIndent + '    ';

    const newBlock = [
        `${blockIndent}<fieldPermissions>`,
        `${childIndent}<editable>${permission.editable}</editable>`,
        `${childIndent}<field>${escapeXml(permission.field)}</field>`,
        `${childIndent}<readable>${permission.readable}</readable>`,
        `${blockIndent}</fieldPermissions>`
    ].join(lineEnding);


    /*
     * Get the object from the field.
     *
     * Example:
     *
     * Account.Name
     *       ↓
     * Account
     */
    const fieldParts =
        permission.field.split('.');

    if (fieldParts.length !== 2) {
        throw new Error(
            `Invalid field format: ${permission.field}. Expected Object.Field.`
        );
    }

    const objectName =
        fieldParts[0];


    /*
     * Find all existing fieldPermissions blocks.
     */
    const fieldPermissionsRegex =
        /<fieldPermissions>([\s\S]*?)<\/fieldPermissions>/g;

    const blocks = [];

    let match;

    while (
        (match = fieldPermissionsRegex.exec(content)) !== null
    ) {

        const fullBlock = match[0];
        const body = match[1];

        const fieldMatch = body.match(
            /<field>([\s\S]*?)<\/field>/
        );

        if (!fieldMatch) {
            continue;
        }

        const existingField =
            fieldMatch[1].trim();

        const existingParts =
            existingField.split('.');

        if (existingParts.length !== 2) {
            continue;
        }

        blocks.push({
            field: existingField,
            objectName: existingParts[0],
            start: match.index,
            end: match.index + fullBlock.length
        });
    }


    /*
     * ---------------------------------------------------------
     * CASE 1:
     * Existing fields for the same object were found.
     *
     * Example:
     *
     * Account.Name
     * Account.Phone
     * Contact.Email
     *
     * Adding:
     *
     * Account.Industry
     *
     * Result:
     *
     * Account.Name
     * Account.Phone
     * Account.Industry
     * Contact.Email
     * ---------------------------------------------------------
     */
    const sameObjectBlocks =
        blocks.filter(
            block =>
                block.objectName === objectName
        );

    if (sameObjectBlocks.length > 0) {

        /*
         * Find the last fieldPermissions block
         * belonging to this object.
         */
        const lastBlock =
            sameObjectBlocks[
                sameObjectBlocks.length - 1
            ];

        return (
            content.substring(
                0,
                lastBlock.end
            )
            +
            lineEnding
            +
            newBlock
            +
            content.substring(
                lastBlock.end
            )
        );
    }


    /*
     * ---------------------------------------------------------
     * CASE 2:
     * No fields for this object exist.
     *
     * Insert before the first fieldPermissions block.
     *
     * Example:
     *
     * Existing:
     *
     * Contact.Email
     * Lead.Status
     *
     * Adding:
     *
     * Account.Name
     *
     * Result:
     *
     * Account.Name
     * Contact.Email
     * Lead.Status
     * ---------------------------------------------------------
     */
    if (blocks.length > 0) {

        const firstBlock =
            blocks[0];

        return (
            content.substring(
                0,
                firstBlock.start
            )
            +
            newBlock
            +
            lineEnding
            +
            content.substring(
                firstBlock.start
            )
        );
    }


    /*
     * ---------------------------------------------------------
     * CASE 3:
     * No fieldPermissions exist at all.
     *
     * Fall back to inserting before the closing
     * PermissionSet/Profile tag.
     * ---------------------------------------------------------
     */

    if (content.includes('</PermissionSet>')) {

        return content.replace(
            '</PermissionSet>',
            `${newBlock}${lineEnding}</PermissionSet>`
        );
    }

    if (content.includes('</Profile>')) {

        return content.replace(
            '</Profile>',
            `${newBlock}${lineEnding}</Profile>`
        );
    }

    throw new Error(
        'Could not determine Salesforce metadata type.'
    );
}


function updateObjectPermission(content, permission) {

    const lineEnding = getLineEnding(content);

    const objectPermissionsRegex =
        /<objectPermissions>([\s\S]*?)<\/objectPermissions>/g;

    let found = false;

    /*
     * Check if object permission already exists.
     */
    const updatedContent = content.replace(
        objectPermissionsRegex,
        (fullBlock, body) => {

            const objectMatch = body.match(
                /<object>([\s\S]*?)<\/object>/
            );

            if (!objectMatch) {
                return fullBlock;
            }

            const existingObject =
                objectMatch[1].trim();

            if (existingObject !== permission.object) {
                return fullBlock;
            }

            found = true;

            return updateExistingObjectPermission(
                fullBlock,
                permission
            );
        }
    );

    /*
     * Object already exists.
     * Return the updated content.
     */
    if (found) {
        return updatedContent;
    }

    /*
     * Object doesn't exist.
     * Create a new object permission.
     */
    return addObjectPermission(
        content,
        permission,
        lineEnding
    );
}


function updateExistingObjectPermission(
    block,
    permission
) {

    let result = block;

    result = replaceBoolean(
        result,
        'allowCreate',
        permission.allowCreate
    );

    result = replaceBoolean(
        result,
        'allowDelete',
        permission.allowDelete
    );

    result = replaceBoolean(
        result,
        'allowEdit',
        permission.allowEdit
    );

    result = replaceBoolean(
        result,
        'allowRead',
        permission.allowRead
    );

    result = replaceBoolean(
        result,
        'modifyAllRecords',
        permission.modifyAllRecords
    );

    result = replaceBoolean(
        result,
        'viewAllFields',
        permission.viewAllFields
    );

    result = replaceBoolean(
        result,
        'viewAllRecords',
        permission.viewAllRecords
    );

    return result;
}


function replaceBoolean(
    content,
    tag,
    value
) {

    const regex =
        new RegExp(
            `<${tag}>(true|false)<\\/${tag}>`
        );

    return content.replace(
        regex,
        `<${tag}>${value}</${tag}>`
    );
}


function addObjectPermission(
    content,
    permission,
    lineEnding
) {

    /*
     * Determine indentation.
     *
     * If objectPermissions already exist,
     * use their indentation.
     */
    let blockIndent = '';

    const existingObjectMatch =
        content.match(
            /^(\s*)<objectPermissions>/m
        );

    if (existingObjectMatch) {
        blockIndent =
            existingObjectMatch[1];
    } else {

        /*
         * Otherwise use fieldPermissions indentation.
         */
        const fieldMatch =
            content.match(
                /^(\s*)<fieldPermissions>/m
            );

        if (fieldMatch) {
            blockIndent =
                fieldMatch[1];
        }
    }

    const childIndent =
        blockIndent + '    ';

    const newBlock = [
        `${blockIndent}<objectPermissions>`,
        `${childIndent}<allowCreate>${permission.allowCreate}</allowCreate>`,
        `${childIndent}<allowDelete>${permission.allowDelete}</allowDelete>`,
        `${childIndent}<allowEdit>${permission.allowEdit}</allowEdit>`,
        `${childIndent}<allowRead>${permission.allowRead}</allowRead>`,
        `${childIndent}<modifyAllRecords>${permission.modifyAllRecords}</modifyAllRecords>`,
        `${childIndent}<object>${escapeXml(permission.object)}</object>`,
        `${childIndent}<viewAllFields>${permission.viewAllFields}</viewAllFields>`,
        `${childIndent}<viewAllRecords>${permission.viewAllRecords}</viewAllRecords>`,
        `${blockIndent}</objectPermissions>`
    ].join(lineEnding);


    /*
     * ---------------------------------------------------------
     * CASE 1
     *
     * Object permissions already exist.
     *
     * Add new object permission after the last
     * objectPermissions block.
     * ---------------------------------------------------------
     */

    const objectPermissionsRegex =
        /<objectPermissions>([\s\S]*?)<\/objectPermissions>/g;

    const objectBlocks = [];

    let match;

    while (
        (match =
            objectPermissionsRegex.exec(content)) !== null
    ) {

        objectBlocks.push({
            start: match.index,
            end: match.index + match[0].length
        });
    }

    if (objectBlocks.length > 0) {

        const lastBlock =
            objectBlocks[
                objectBlocks.length - 1
            ];

        return (
            content.substring(
                0,
                lastBlock.end
            )
            +
            lineEnding
            +
            newBlock
            +
            content.substring(
                lastBlock.end
            )
        );
    }


    /*
     * ---------------------------------------------------------
     * CASE 2
     *
     * No objectPermissions exist.
     *
     * Add objectPermissions AFTER the last
     * fieldPermissions block.
     * ---------------------------------------------------------
     */

    const fieldPermissionsRegex =
        /<fieldPermissions>([\s\S]*?)<\/fieldPermissions>/g;

    const fieldBlocks = [];

    while (
        (match =
            fieldPermissionsRegex.exec(content)) !== null
    ) {

        fieldBlocks.push({
            start: match.index,
            end: match.index + match[0].length
        });
    }

    if (fieldBlocks.length > 0) {

        const lastFieldBlock =
            fieldBlocks[
                fieldBlocks.length - 1
            ];

        return (
            content.substring(
                0,
                lastFieldBlock.end
            )
            +
            lineEnding
            +
            newBlock
            +
            content.substring(
                lastFieldBlock.end
            )
        );
    }


    /*
     * ---------------------------------------------------------
     * CASE 3
     *
     * No fieldPermissions and no objectPermissions.
     *
     * Add before PermissionSet/Profile closing tag.
     * ---------------------------------------------------------
     */

    if (content.includes('</PermissionSet>')) {

        return content.replace(
            '</PermissionSet>',
            `${newBlock}${lineEnding}</PermissionSet>`
        );
    }

    if (content.includes('</Profile>')) {

        return content.replace(
            '</Profile>',
            `${newBlock}${lineEnding}</Profile>`
        );
    }

    throw new Error(
        'Could not determine Salesforce metadata type.'
    );
}


function updateClassPermission(
    content,
    permission
) {

    const lineEnding =
        getLineEnding(content);

    const classAccessesRegex =
        /<classAccesses>([\s\S]*?)<\/classAccesses>/g;

    let found = false;

    /*
     * Check whether the Apex class already exists.
     */
    const updatedContent =
        content.replace(
            classAccessesRegex,
            (fullBlock, body) => {

                const classMatch =
                    body.match(
                        /<apexClass>([\s\S]*?)<\/apexClass>/
                    );

                if (!classMatch) {
                    return fullBlock;
                }

                const existingClass =
                    classMatch[1].trim();

                if (
                    existingClass !==
                    permission.apexClass
                ) {
                    return fullBlock;
                }

                found = true;

                return updateExistingClassPermission(
                    fullBlock,
                    permission
                );
            }
        );


    /*
     * Existing class found.
     */
    if (found) {
        return updatedContent;
    }


    /*
     * Class doesn't exist.
     * Create a new classAccesses block.
     */
    return addClassPermission(
        content,
        permission,
        lineEnding
    );
}


function updateExistingClassPermission(
    block,
    permission
) {

    return block.replace(
        /<enabled>(true|false)<\/enabled>/,
        `<enabled>${permission.enabled}</enabled>`
    );
}


function addClassPermission(
    content,
    permission,
    lineEnding
) {

    /*
     * Find indentation from existing classAccesses.
     */
    let blockIndent = '';

    const classMatch =
        content.match(
            /^(\s*)<classAccesses>/m
        );

    if (classMatch) {

        blockIndent =
            classMatch[1];

    } else {

        /*
         * If there are no classAccesses,
         * use indentation from other permission sections.
         */
        const permissionMatch =
            content.match(
                /^(\s*)<(fieldPermissions|objectPermissions)>/m
            );

        if (permissionMatch) {
            blockIndent =
                permissionMatch[1];
        }
    }


    const childIndent =
        blockIndent + '    ';


    const newBlock = [
        `${blockIndent}<classAccesses>`,
        `${childIndent}<apexClass>${escapeXml(permission.apexClass)}</apexClass>`,
        `${childIndent}<enabled>${permission.enabled}</enabled>`,
        `${blockIndent}</classAccesses>`
    ].join(lineEnding);


    /*
     * ---------------------------------------------------------
     * CASE 1
     *
     * Existing classAccesses exist.
     *
     * Add after the last classAccesses block.
     * ---------------------------------------------------------
     */

    const classAccessesRegex =
        /<classAccesses>([\s\S]*?)<\/classAccesses>/g;

    const classBlocks = [];

    let match;

    while (
        (match =
            classAccessesRegex.exec(content)) !== null
    ) {

        classBlocks.push({
            start: match.index,
            end: match.index + match[0].length
        });
    }


    if (classBlocks.length > 0) {

        const lastBlock =
            classBlocks[
                classBlocks.length - 1
            ];

        return (
            content.substring(
                0,
                lastBlock.end
            )
            +
            lineEnding
            +
            newBlock
            +
            content.substring(
                lastBlock.end
            )
        );
    }


    /*
     * ---------------------------------------------------------
     * CASE 2
     *
     * No classAccesses exist.
     *
     * Put classAccesses after the existing permission sections.
     *
     * Prefer objectPermissions first, then fieldPermissions.
     * ---------------------------------------------------------
     */

    const objectPermissionsRegex =
        /<objectPermissions>([\s\S]*?)<\/objectPermissions>/g;

    const objectBlocks = [];

    while (
        (match =
            objectPermissionsRegex.exec(content)) !== null
    ) {

        objectBlocks.push({
            start: match.index,
            end: match.index + match[0].length
        });
    }


    if (objectBlocks.length > 0) {

        const lastObjectBlock =
            objectBlocks[
                objectBlocks.length - 1
            ];

        return (
            content.substring(
                0,
                lastObjectBlock.end
            )
            +
            lineEnding
            +
            newBlock
            +
            content.substring(
                lastObjectBlock.end
            )
        );
    }


    /*
     * If there are no object permissions,
     * put it after the last field permission.
     */
    const fieldPermissionsRegex =
        /<fieldPermissions>([\s\S]*?)<\/fieldPermissions>/g;

    const fieldBlocks = [];

    while (
        (match =
            fieldPermissionsRegex.exec(content)) !== null
    ) {

        fieldBlocks.push({
            start: match.index,
            end: match.index + match[0].length
        });
    }


    if (fieldBlocks.length > 0) {

        const lastFieldBlock =
            fieldBlocks[
                fieldBlocks.length - 1
            ];

        return (
            content.substring(
                0,
                lastFieldBlock.end
            )
            +
            lineEnding
            +
            newBlock
            +
            content.substring(
                lastFieldBlock.end
            )
        );
    }


    /*
     * ---------------------------------------------------------
     * CASE 3
     *
     * No permission sections exist.
     *
     * Add before PermissionSet/Profile closing tag.
     * ---------------------------------------------------------
     */

    if (content.includes('</PermissionSet>')) {

        return content.replace(
            '</PermissionSet>',
            `${newBlock}${lineEnding}</PermissionSet>`
        );
    }


    if (content.includes('</Profile>')) {

        return content.replace(
            '</Profile>',
            `${newBlock}${lineEnding}</Profile>`
        );
    }


    throw new Error(
        'Could not determine Salesforce metadata type.'
    );
}


function updateCustomPermission(
    content,
    permission
) {

    const lineEnding =
        getLineEnding(content);

    const customPermissionsRegex =
        /<customPermissions>([\s\S]*?)<\/customPermissions>/g;

    let found = false;


    /*
     * Check whether the Custom Permission already exists.
     */
    const updatedContent =
        content.replace(
            customPermissionsRegex,
            (fullBlock, body) => {

                const nameMatch =
                    body.match(
                        /<name>([\s\S]*?)<\/name>/
                    );

                if (!nameMatch) {
                    return fullBlock;
                }

                const existingName =
                    nameMatch[1].trim();

                if (
                    existingName !==
                    permission.name
                ) {
                    return fullBlock;
                }

                found = true;

                return updateExistingCustomPermission(
                    fullBlock,
                    permission
                );
            }
        );


    /*
     * Existing Custom Permission found.
     */
    if (found) {
        return updatedContent;
    }


    /*
     * Custom Permission doesn't exist.
     * Create a new one.
     */
    return addCustomPermission(
        content,
        permission,
        lineEnding
    );
}


function updateExistingCustomPermission(
    block,
    permission
) {

    return block.replace(
        /<enabled>(true|false)<\/enabled>/,
        `<enabled>${permission.enabled}</enabled>`
    );
}


function addCustomPermission(
    content,
    permission,
    lineEnding
) {

    /*
     * Determine indentation from existing
     * customPermissions first.
     */
    let blockIndent = '';

    const existingCustomPermission =
        content.match(
            /^(\s*)<customPermissions>/m
        );

    if (existingCustomPermission) {

        blockIndent =
            existingCustomPermission[1];

    } else {

        /*
         * If there are no customPermissions,
         * use indentation from other permission sections.
         */
        const permissionMatch =
            content.match(
                /^(\s*)<(classAccesses|objectPermissions|fieldPermissions)>/m
            );

        if (permissionMatch) {

            blockIndent =
                permissionMatch[1];
        }
    }


    const childIndent =
        blockIndent + '    ';


    const newBlock = [
        `${blockIndent}<customPermissions>`,
        `${childIndent}<enabled>${permission.enabled}</enabled>`,
        `${childIndent}<name>${escapeXml(permission.name)}</name>`,
        `${blockIndent}</customPermissions>`
    ].join(lineEnding);


    /*
     * ---------------------------------------------------------
     * CASE 1
     *
     * Existing customPermissions exist.
     *
     * Add after the last customPermissions block.
     * ---------------------------------------------------------
     */

    const customPermissionsRegex =
        /<customPermissions>([\s\S]*?)<\/customPermissions>/g;

    const customBlocks = [];

    let match;

    while (
        (match =
            customPermissionsRegex.exec(content)) !== null
    ) {

        customBlocks.push({
            start: match.index,
            end: match.index + match[0].length
        });
    }


    if (customBlocks.length > 0) {

        const lastBlock =
            customBlocks[
                customBlocks.length - 1
            ];

        return (
            content.substring(
                0,
                lastBlock.end
            )
            +
            lineEnding
            +
            newBlock
            +
            content.substring(
                lastBlock.end
            )
        );
    }


    /*
     * ---------------------------------------------------------
     * CASE 2
     *
     * No customPermissions exist.
     *
     * Add after classAccesses if available.
     * ---------------------------------------------------------
     */

    const classAccessesRegex =
        /<classAccesses>([\s\S]*?)<\/classAccesses>/g;

    const classBlocks = [];

    while (
        (match =
            classAccessesRegex.exec(content)) !== null
    ) {

        classBlocks.push({
            start: match.index,
            end: match.index + match[0].length
        });
    }


    if (classBlocks.length > 0) {

        const lastClassBlock =
            classBlocks[
                classBlocks.length - 1
            ];

        return (
            content.substring(
                0,
                lastClassBlock.end
            )
            +
            lineEnding
            +
            newBlock
            +
            content.substring(
                lastClassBlock.end
            )
        );
    }


    /*
     * ---------------------------------------------------------
     * CASE 3
     *
     * No classAccesses.
     *
     * Add after objectPermissions.
     * ---------------------------------------------------------
     */

    const objectPermissionsRegex =
        /<objectPermissions>([\s\S]*?)<\/objectPermissions>/g;

    const objectBlocks = [];

    while (
        (match =
            objectPermissionsRegex.exec(content)) !== null
    ) {

        objectBlocks.push({
            start: match.index,
            end: match.index + match[0].length
        });
    }


    if (objectBlocks.length > 0) {

        const lastObjectBlock =
            objectBlocks[
                objectBlocks.length - 1
            ];

        return (
            content.substring(
                0,
                lastObjectBlock.end
            )
            +
            lineEnding
            +
            newBlock
            +
            content.substring(
                lastObjectBlock.end
            )
        );
    }


    /*
     * ---------------------------------------------------------
     * CASE 4
     *
     * No objectPermissions.
     *
     * Add after fieldPermissions.
     * ---------------------------------------------------------
     */

    const fieldPermissionsRegex =
        /<fieldPermissions>([\s\S]*?)<\/fieldPermissions>/g;

    const fieldBlocks = [];

    while (
        (match =
            fieldPermissionsRegex.exec(content)) !== null
    ) {

        fieldBlocks.push({
            start: match.index,
            end: match.index + match[0].length
        });
    }


    if (fieldBlocks.length > 0) {

        const lastFieldBlock =
            fieldBlocks[
                fieldBlocks.length - 1
            ];

        return (
            content.substring(
                0,
                lastFieldBlock.end
            )
            +
            lineEnding
            +
            newBlock
            +
            content.substring(
                lastFieldBlock.end
            )
        );
    }


    /*
     * ---------------------------------------------------------
     * CASE 5
     *
     * No permission sections exist.
     *
     * Add before PermissionSet/Profile closing tag.
     * ---------------------------------------------------------
     */

    if (content.includes('</PermissionSet>')) {

        return content.replace(
            '</PermissionSet>',
            `${newBlock}${lineEnding}</PermissionSet>`
        );
    }


    if (content.includes('</Profile>')) {

        return content.replace(
            '</Profile>',
            `${newBlock}${lineEnding}</Profile>`
        );
    }


    throw new Error(
        'Could not determine Salesforce metadata type.'
    );
}



//layout

function updateLayoutAssignment(
    content,
    permission
) {

    const lineEnding =
        getLineEnding(content);

    const layoutAssignmentsRegex =
        /<layoutAssignments>([\s\S]*?)<\/layoutAssignments>/g;

    let found = false;


    /*
     * ---------------------------------------------------------
     * Check whether the exact assignment already exists.
     * ---------------------------------------------------------
     */
    const updatedContent =
        content.replace(
            layoutAssignmentsRegex,
            (fullBlock, body) => {

                const layoutMatch =
                    body.match(
                        /<layout>([\s\S]*?)<\/layout>/
                    );

                if (!layoutMatch) {
                    return fullBlock;
                }

                const existingLayout =
                    layoutMatch[1].trim();


                if (
                    existingLayout !==
                    permission.layout
                ) {
                    return fullBlock;
                }


                /*
                 * Existing assignment has a record type.
                 */
                const recordTypeMatch =
                    body.match(
                        /<recordType>([\s\S]*?)<\/recordType>/
                    );

                const existingRecordType =
                    recordTypeMatch
                        ? recordTypeMatch[1].trim()
                        : null;


                /*
                 * Both have record types.
                 *
                 * Match layout + recordType.
                 */
                if (
                    permission.recordType &&
                    existingRecordType
                ) {

                    if (
                        existingRecordType ===
                        permission.recordType
                    ) {

                        found = true;

                        return fullBlock;
                    }

                    return fullBlock;
                }


                /*
                 * Existing assignment has no record type
                 * and incoming assignment also has no record type.
                 */
                if (
                    !permission.recordType &&
                    !existingRecordType
                ) {

                    found = true;

                    return fullBlock;
                }


                /*
                 * Layout is same but one has a record type
                 * and the other doesn't.
                 *
                 * These are treated as different assignments.
                 */
                return fullBlock;
            }
        );


    /*
     * Exact assignment already exists.
     */
    if (found) {
        return updatedContent;
    }


    /*
     * Assignment doesn't exist.
     * Add a new one.
     */
    return addLayoutAssignment(
        content,
        permission,
        lineEnding
    );
}

function addLayoutAssignment(
    content,
    permission,
    lineEnding
) {

    /*
     * Determine indentation.
     */
    let blockIndent = '';

    const existingLayout =
        content.match(
            /^(\s*)<layoutAssignments>/m
        );

    if (existingLayout) {

        blockIndent =
            existingLayout[1];

    } else {

        /*
         * Fall back to other permission sections.
         */
        const permissionMatch =
            content.match(
                /^(\s*)<(customPermissions|classAccesses|objectPermissions|fieldPermissions)>/m
            );

        if (permissionMatch) {
            blockIndent =
                permissionMatch[1];
        }
    }


    const childIndent =
        blockIndent + '    ';


    /*
     * Build the block.
     */
    const lines = [
        `${blockIndent}<layoutAssignments>`,
        `${childIndent}<layout>${escapeXml(permission.layout)}</layout>`
    ];


    /*
     * Only add recordType when provided.
     */
    if (permission.recordType) {

        lines.push(
            `${childIndent}<recordType>${escapeXml(permission.recordType)}</recordType>`
        );
    }


    lines.push(
        `${blockIndent}</layoutAssignments>`
    );


    const newBlock =
        lines.join(lineEnding);


    /*
     * ---------------------------------------------------------
     * CASE 1
     *
     * Existing layoutAssignments exist.
     *
     * Add after the last one.
     * ---------------------------------------------------------
     */
    const layoutAssignmentsRegex =
        /<layoutAssignments>([\s\S]*?)<\/layoutAssignments>/g;

    const layoutBlocks = [];

    let match;

    while (
        (match =
            layoutAssignmentsRegex.exec(content)) !== null
    ) {

        layoutBlocks.push({
            start: match.index,
            end: match.index + match[0].length
        });
    }


    if (layoutBlocks.length > 0) {

        const lastBlock =
            layoutBlocks[
                layoutBlocks.length - 1
            ];

        return (
            content.substring(
                0,
                lastBlock.end
            )
            +
            lineEnding
            +
            newBlock
            +
            content.substring(
                lastBlock.end
            )
        );
    }


    /*
     * ---------------------------------------------------------
     * CASE 2
     *
     * No layoutAssignments exist.
     *
     * Add after customPermissions.
     * ---------------------------------------------------------
     */
    const customPermissionsRegex =
        /<customPermissions>([\s\S]*?)<\/customPermissions>/g;

    const customBlocks = [];

    while (
        (match =
            customPermissionsRegex.exec(content)) !== null
    ) {

        customBlocks.push({
            start: match.index,
            end: match.index + match[0].length
        });
    }


    if (customBlocks.length > 0) {

        const lastBlock =
            customBlocks[
                customBlocks.length - 1
            ];

        return (
            content.substring(
                0,
                lastBlock.end
            )
            +
            lineEnding
            +
            newBlock
            +
            content.substring(
                lastBlock.end
            )
        );
    }


    /*
     * ---------------------------------------------------------
     * CASE 3
     *
     * No customPermissions.
     *
     * Add after classAccesses.
     * ---------------------------------------------------------
     */
    const classAccessesRegex =
        /<classAccesses>([\s\S]*?)<\/classAccesses>/g;

    const classBlocks = [];

    while (
        (match =
            classAccessesRegex.exec(content)) !== null
    ) {

        classBlocks.push({
            start: match.index,
            end: match.index + match[0].length
        });
    }


    if (classBlocks.length > 0) {

        const lastBlock =
            classBlocks[
                classBlocks.length - 1
            ];

        return (
            content.substring(
                0,
                lastBlock.end
            )
            +
            lineEnding
            +
            newBlock
            +
            content.substring(
                lastBlock.end
            )
        );
    }


    /*
     * ---------------------------------------------------------
     * CASE 4
     *
     * No classAccesses.
     *
     * Add after objectPermissions.
     * ---------------------------------------------------------
     */
    const objectPermissionsRegex =
        /<objectPermissions>([\s\S]*?)<\/objectPermissions>/g;

    const objectBlocks = [];

    while (
        (match =
            objectPermissionsRegex.exec(content)) !== null
    ) {

        objectBlocks.push({
            start: match.index,
            end: match.index + match[0].length
        });
    }


    if (objectBlocks.length > 0) {

        const lastBlock =
            objectBlocks[
                objectBlocks.length - 1
            ];

        return (
            content.substring(
                0,
                lastBlock.end
            )
            +
            lineEnding
            +
            newBlock
            +
            content.substring(
                lastBlock.end
            )
        );
    }


    /*
     * ---------------------------------------------------------
     * CASE 5
     *
     * No objectPermissions.
     *
     * Add after fieldPermissions.
     * ---------------------------------------------------------
     */
    const fieldPermissionsRegex =
        /<fieldPermissions>([\s\S]*?)<\/fieldPermissions>/g;

    const fieldBlocks = [];

    while (
        (match =
            fieldPermissionsRegex.exec(content)) !== null
    ) {

        fieldBlocks.push({
            start: match.index,
            end: match.index + match[0].length
        });
    }


    if (fieldBlocks.length > 0) {

        const lastBlock =
            fieldBlocks[
                fieldBlocks.length - 1
            ];

        return (
            content.substring(
                0,
                lastBlock.end
            )
            +
            lineEnding
            +
            newBlock
            +
            content.substring(
                lastBlock.end
            )
        );
    }


    /*
     * ---------------------------------------------------------
     * CASE 6
     *
     * No permission sections.
     *
     * Add before closing tag.
     * ---------------------------------------------------------
     */

    if (content.includes('</PermissionSet>')) {

        return content.replace(
            '</PermissionSet>',
            `${newBlock}${lineEnding}</PermissionSet>`
        );
    }


    if (content.includes('</Profile>')) {

        return content.replace(
            '</Profile>',
            `${newBlock}${lineEnding}</Profile>`
        );
    }


    throw new Error(
        'Could not determine Salesforce metadata type.'
    );
}


module.exports = {
    updateFieldPermission,
    updateObjectPermission,
    updateClassPermission,
    updateCustomPermission,
    updateLayoutAssignment
};