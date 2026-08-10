const vscode = require('vscode');
const path = require('path');

const {
    getPermissionFiles,
    readFile,
    writeFile
} = require('../services/fileService');

const {
    updateFieldPermission, updateObjectPermission,updateClassPermission,updateCustomPermission,updateLayoutAssignment
} = require('../services/permissionService');

async function runPermissionManager() {

    // 1. Select folder
    const folderSelection =
        await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select Salesforce Metadata Folder'
        });

    if (!folderSelection?.length) {
        return;
    }

    const folderPath =
        folderSelection[0].fsPath;

    // 2. Find Permission Sets / Profiles
    const files =
        await getPermissionFiles(folderPath);

    if (!files.length) {
        vscode.window.showWarningMessage(
            'No Permission Set or Profile metadata files found.'
        );
        return;
    }

    // 3. Select files
    const selectedFiles =
        await vscode.window.showQuickPick(
            files.map(filePath => ({
                label: path.basename(filePath),
                description: filePath
            })),
            {
                canPickMany: true,
                placeHolder: 'Select files to update'
            }
        );

    if (!selectedFiles?.length) {
        return;
    }

    // 4. Select permission type
    const permissionType =
        await vscode.window.showQuickPick(
            [
                {
                    label: 'Field Permission',
                    value: 'field'
                },
                {
                    label: 'Object Permission',
                    value: 'object'
                },
                {
                    label: 'Class Permission',
                    value: 'Class'
                },
                {
                    label: 'Custom Permissions',
                    value: 'custom'
                },
                {
                    label: 'Layout Assignments',
                    value: 'layoutAssignments'
                },
                {
                    label: 'User Permissions',
                    value: 'user'
                }
            ],
            {
                placeHolder: 'Select permission type'
            }
        );

    if (!permissionType) {
        return;
    }

    if (permissionType.value === 'field') {
        await handleFieldPermission(
            selectedFiles.map(file => file.description)
        );
    }
    else if(permissionType.value === 'object') {
        await handleObjectPermission(
            selectedFiles.map(file => file.description)
        );
    }

    else if(permissionType.value === 'Class') {
        await handleClassPermission(
            selectedFiles.map(file => file.description)
        );
    }
    else if(permissionType.value === 'custom') {
        await handleCustomPermission(
            selectedFiles.map(file => file.description)
        );
    }
    else if(permissionType.value === 'layoutAssignments') {
        await handleLayoutAssignmentsPermission(
            selectedFiles.map(file => file.description)
        );
    }
    else if(permissionType.value === 'user') {
        await handleUserPermission(
            selectedFiles.map(file => file.description)
        );
    }
}


/*
 * ============================================================
 * OBJECT PERMISSION
 * ============================================================
 */

async function handleObjectPermission(filePaths) {

    // 5. Object names
    const objectsInput =
        await vscode.window.showInputBox({
            prompt: 'Enter Salesforce object API names (comma-separated)',
            placeHolder:
                'Account, Contact, RES_Installment__c',

            validateInput(value) {

                if (!value.trim()) {
                    return 'At least one object API name is required.';
                }

                const objects =
                    value
                        .split(',')
                        .map(object => object.trim())
                        .filter(Boolean);

                if (!objects.length) {
                    return 'At least one object API name is required.';
                }

                return undefined;
            }
        });

    if (!objectsInput) {
        return;
    }

    const objects =
        objectsInput
            .split(',')
            .map(object => object.trim())
            .filter(Boolean);


    // 6. CRUD permissions
    const crudPermissions =
        await vscode.window.showQuickPick(
            [
                {
                    label: 'Create',
                    description: 'Allow users to create records',
                    value: 'create'
                },
                {
                    label: 'Read',
                    description: 'Allow users to read records',
                    value: 'read'
                },
                {
                    label: 'Edit',
                    description: 'Allow users to edit records',
                    value: 'edit'
                },
                {
                    label: 'Delete',
                    description: 'Allow users to delete records',
                    value: 'delete'
                }
            ],
            {
                canPickMany: true,
                placeHolder:
                    'Select CRUD permissions'
            }
        );

    if (!crudPermissions) {
        return;
    }


    // 7. Additional permissions
    const additionalPermissions =
        await vscode.window.showQuickPick(
            [
                {
                    label: 'View All Fields',
                    description:
                        'Allow viewing all fields on the object',
                    value: 'viewAllFields'
                },
                {
                    label: 'Modify All Records',
                    description:
                        'Allow modifying all records',
                    value: 'modifyAllRecords'
                },
                {
                    label: 'View All Records',
                    description:
                        'Allow viewing all records',
                    value: 'viewAllRecords'
                }
            ],
            {
                canPickMany: true,
                placeHolder:
                    'Select additional object permissions'
            }
        );

    if (!additionalPermissions) {
        return;
    }


    // 8. Build permission object
    const permission = {

        allowCreate:
            crudPermissions.some(
                item => item.value === 'create'
            ),

        allowRead:
            crudPermissions.some(
                item => item.value === 'read'
            ),

        allowEdit:
            crudPermissions.some(
                item => item.value === 'edit'
            ),

        allowDelete:
            crudPermissions.some(
                item => item.value === 'delete'
            ),

        viewAllFields:
            additionalPermissions.some(
                item => item.value === 'viewAllFields'
            ),

        modifyAllRecords:
            additionalPermissions.some(
                item => item.value === 'modifyAllRecords'
            ),

        viewAllRecords:
            additionalPermissions.some(
                item => item.value === 'viewAllRecords'
            )
    };


    // 9. Confirm
    const confirmation =
        await vscode.window.showInformationMessage(
            `Update ${objects.length} object(s) in ${filePaths.length} file(s)?`,
            {
                modal: true
            },
            'Update'
        );

    if (confirmation !== 'Update') {
        return;
    }


    // 10. Update
    let updated = 0;
    let unchanged = 0;
    let failed = 0;

    for (const filePath of filePaths) {

        try {

            let content =
                await readFile(filePath);

            let fileUpdated = false;

            for (const object of objects) {

                const updatedContent =
                    updateObjectPermission(
                        content,
                        {
                            object,
                            ...permission
                        }
                    );

                if (content !== updatedContent) {

                    content = updatedContent;
                    fileUpdated = true;
                }
            }

            if (!fileUpdated) {

                unchanged++;
                continue;
            }

            await writeFile(
                filePath,
                content
            );

            updated++;

        } catch (error) {

            failed++;

            console.error(
                `Failed to update ${filePath}`,
                error
            );
        }
    }


    vscode.window.showInformationMessage(
        `Permission Manager: ${updated} updated, ${unchanged} unchanged, ${failed} failed.`
    );
}


/*
 * ============================================================
 * Field PERMISSION
 * ============================================================
 */

async function handleFieldPermission(filePaths) {

    // 5. Field names
    const fieldsInput =
        await vscode.window.showInputBox({
            prompt: 'Enter Salesforce field API names (comma-separated)',
            placeHolder: 'Account.Name, Account.Industry, Contact.Email',
            validateInput(value) {

                if (!value.trim()) {
                    return 'At least one field API name is required.';
                }

                const fields = value
                    .split(',')
                    .map(field => field.trim())
                    .filter(Boolean);

                for (const field of fields) {
                    if (!field.includes('.')) {
                        return `Invalid field: ${field}. Use Object.Field format.`;
                    }
                }

                return undefined;
            }
        });

    if (!fieldsInput) {
        return;
    }

    const fields = fieldsInput
        .split(',')
        .map(field => field.trim())
        .filter(Boolean);

    // 6. Permission
    const permission =
        await vscode.window.showQuickPick(
            [
                {
                    label: 'Read',
                    description: 'Read only',
                    readable: true,
                    editable: false
                },
                {
                    label: 'Read + Write',
                    description: 'Read and edit',
                    readable: true,
                    editable: true
                },
                {
                    label: 'Write',
                    description: 'Read and edit',
                    readable: false,
                    editable: true
                }
            ],
            {
                placeHolder: 'Select field permission'
            }
        );

    if (!permission) {
        return;
    }

    // 7. Confirm
    const confirmation =
        await vscode.window.showInformationMessage(
            `Update ${fields.length} field(s) in ${filePaths.length} file(s)?`,
            {
                modal: true
            },
            'Update'
        );

    if (confirmation !== 'Update') {
        return;
    }

    // 8. Update
    let updated = 0;
    let unchanged = 0;
    let failed = 0;

    for (const filePath of filePaths) {

        try {

            let content =
                await readFile(filePath);

            let fileUpdated = false;

            for (const field of fields) {

                const updatedContent =
                    updateFieldPermission(
                        content,
                        {
                            field,
                            readable: permission.readable,
                            editable: permission.editable
                        }
                    );

                if (content !== updatedContent) {
                    content = updatedContent;
                    fileUpdated = true;
                }
            }

            if (!fileUpdated) {
                unchanged++;
                continue;
            }

            await writeFile(
                filePath,
                content
            );

            updated++;

        } catch (error) {

            failed++;

            console.error(
                `Failed to update ${filePath}`,
                error
            );
        }
    }

    // 9. Result
    vscode.window.showInformationMessage(
        `Permission Manager: ${updated} updated, ${unchanged} unchanged, ${failed} failed.`
    );
}




/*
 * ============================================================
 * Class PERMISSION
 * ============================================================
 */


async function handleClassPermission(filePaths) {

    // 1. Class names
    const classesInput =
        await vscode.window.showInputBox({
            prompt: 'Enter Apex class names (comma-separated)',
            placeHolder:
                'RES_AccountConvertedLeadController, RES_LeadController',

            validateInput(value) {

                if (!value.trim()) {
                    return 'At least one Apex class name is required.';
                }

                const classes =
                    value
                        .split(',')
                        .map(className => className.trim())
                        .filter(Boolean);

                if (!classes.length) {
                    return 'At least one Apex class name is required.';
                }

                for (const className of classes) {

                    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(className)) {
                        return `Invalid Apex class name: ${className}`;
                    }
                }

                return undefined;
            }
        });

    if (!classesInput) {
        return;
    }

    const classes =
        classesInput
            .split(',')
            .map(className => className.trim())
            .filter(Boolean);


    // 2. Enabled
    const enabled =
        await vscode.window.showQuickPick(
            [
                {
                    label: 'Enabled',
                    description: 'Allow access to the Apex classes',
                    value: true
                },
                {
                    label: 'Disabled',
                    description: 'Disable access to the Apex classes',
                    value: false
                }
            ],
            {
                placeHolder:
                    'Select whether Apex class access should be enabled'
            }
        );

    if (!enabled) {
        return;
    }


    // 3. Confirm
    const confirmation =
        await vscode.window.showInformationMessage(
            `Update ${classes.length} Apex class(es) in ${filePaths.length} file(s)?`,
            {
                modal: true
            },
            'Update'
        );

    if (confirmation !== 'Update') {
        return;
    }


    // 4. Update
    let updated = 0;
    let unchanged = 0;
    let failed = 0;

    for (const filePath of filePaths) {

        try {

            let content =
                await readFile(filePath);

            let fileUpdated = false;

            for (const className of classes) {

                const updatedContent =
                    updateClassPermission(
                        content,
                        {
                            apexClass: className,
                            enabled: enabled.value
                        }
                    );

                if (content !== updatedContent) {

                    content = updatedContent;
                    fileUpdated = true;
                }
            }

            if (!fileUpdated) {

                unchanged++;
                continue;
            }

            await writeFile(
                filePath,
                content
            );

            updated++;

        } catch (error) {

            failed++;

            console.error(
                `Failed to update ${filePath}`,
                error
            );

            vscode.window.showErrorMessage(
                `Failed: ${path.basename(filePath)} - ${error.message}`
            );
        }
    }


    vscode.window.showInformationMessage(
        `Permission Manager: ${updated} updated, ${unchanged} unchanged, ${failed} failed.`
    );
}

/*
 * ============================================================
 * Custom PERMISSION
 * ============================================================
 */


async function handleCustomPermission(filePaths) {

    // 1. Custom Permission names
    const customPermissionsInput =
        await vscode.window.showInputBox({
            prompt: 'Enter Custom Permission names (comma-separated)',
            placeHolder:
                'RES_Approval_Work_Item_Visibility, RES_Some_Other_Permission',

            validateInput(value) {

                if (!value.trim()) {
                    return 'At least one Custom Permission name is required.';
                }

                const permissions =
                    value
                        .split(',')
                        .map(permission => permission.trim())
                        .filter(Boolean);

                if (!permissions.length) {
                    return 'At least one Custom Permission name is required.';
                }

                return undefined;
            }
        });

    if (!customPermissionsInput) {
        return;
    }

    const customPermissions =
        customPermissionsInput
            .split(',')
            .map(permission => permission.trim())
            .filter(Boolean);


    // 2. Enabled / Disabled
    const enabled =
        await vscode.window.showQuickPick(
            [
                {
                    label: 'Enabled',
                    description:
                        'Enable the Custom Permission',
                    value: true
                },
                {
                    label: 'Disabled',
                    description:
                        'Disable the Custom Permission',
                    value: false
                }
            ],
            {
                placeHolder:
                    'Select whether Custom Permission should be enabled'
            }
        );

    if (!enabled) {
        return;
    }


    // 3. Confirm
    const confirmation =
        await vscode.window.showInformationMessage(
            `Update ${customPermissions.length} Custom Permission(s) in ${filePaths.length} file(s)?`,
            {
                modal: true
            },
            'Update'
        );

    if (confirmation !== 'Update') {
        return;
    }


    // 4. Update
    let updated = 0;
    let unchanged = 0;
    let failed = 0;

    for (const filePath of filePaths) {

        try {

            let content =
                await readFile(filePath);

            let fileUpdated = false;

            for (const name of customPermissions) {

                const updatedContent =
                    updateCustomPermission(
                        content,
                        {
                            name,
                            enabled: enabled.value
                        }
                    );

                if (content !== updatedContent) {

                    content = updatedContent;
                    fileUpdated = true;
                }
            }

            if (!fileUpdated) {

                unchanged++;
                continue;
            }

            await writeFile(
                filePath,
                content
            );

            updated++;

        } catch (error) {

            failed++;

            console.error(
                `Failed to update ${filePath}`,
                error
            );

            vscode.window.showErrorMessage(
                `Failed: ${path.basename(filePath)} - ${error.message}`
            );
        }
    }


    vscode.window.showInformationMessage(
        `Permission Manager: ${updated} updated, ${unchanged} unchanged, ${failed} failed.`
    );
}


/*
 * ============================================================
 * Layout ASSIGNMENTS
 * ============================================================
 */

async function handleLayoutAssignmentsPermission(filePaths) {

    // 1. Layout names
    const layoutsInput =
        await vscode.window.showInputBox({
            prompt: 'Enter Layout names (comma-separated)',
            placeHolder:
                'Account-RES Company, Account-RES Individual',

            validateInput(value) {

                if (!value.trim()) {
                    return 'At least one Layout name is required.';
                }

                const layouts =
                    value
                        .split(',')
                        .map(layout => layout.trim())
                        .filter(Boolean);

                if (!layouts.length) {
                    return 'At least one Layout name is required.';
                }

                return undefined;
            }
        });

    if (!layoutsInput) {
        return;
    }

    const layouts =
        layoutsInput
            .split(',')
            .map(layout => layout.trim())
            .filter(Boolean);


    // 2. Optional Record Types
    const recordTypesInput =
        await vscode.window.showInputBox({
            prompt:
                'Enter Record Type names (optional, comma-separated)',
            placeHolder:
                'Account.RES_Company, Account.RES_Individual'
        });


    /*
     * Empty input means no record types.
     */
    const recordTypes =
        recordTypesInput
            ? recordTypesInput
                .split(',')
                .map(recordType => recordType.trim())
                .filter(Boolean)
            : [];


    /*
     * If record types are provided, make sure
     * the number matches the number of layouts.
     *
     * Example:
     *
     * Layouts:
     * Account-RES Company, Account-RES Individual
     *
     * Record Types:
     * Account.RES_Company, Account.RES_Individual
     *
     * Layout[0] -> RecordType[0]
     * Layout[1] -> RecordType[1]
     */
    if (
        recordTypes.length > 0 &&
        recordTypes.length !== layouts.length
    ) {

        vscode.window.showErrorMessage(
            `You provided ${layouts.length} layout(s) but ${recordTypes.length} record type(s). Please provide one record type for each layout.`
        );

        return;
    }


    // 3. Confirm
    const confirmation =
        await vscode.window.showInformationMessage(
            `Update ${layouts.length} layout assignment(s) in ${filePaths.length} file(s)?`,
            {
                modal: true
            },
            'Update'
        );

    if (confirmation !== 'Update') {
        return;
    }


    // 4. Update
    let updated = 0;
    let unchanged = 0;
    let failed = 0;

    for (const filePath of filePaths) {

        try {

            let content =
                await readFile(filePath);

            let fileUpdated = false;

            for (let index = 0; index < layouts.length; index++) {

                const layout =
                    layouts[index];

                const recordType =
                    recordTypes.length > 0
                        ? recordTypes[index]
                        : null;

                const updatedContent =
                    updateLayoutAssignment(
                        content,
                        {
                            layout,
                            recordType
                        }
                    );

                if (content !== updatedContent) {

                    content = updatedContent;
                    fileUpdated = true;
                }
            }


            if (!fileUpdated) {

                unchanged++;
                continue;
            }


            await writeFile(
                filePath,
                content
            );

            updated++;

        } catch (error) {

            failed++;

            console.error(
                `Failed to update ${filePath}`,
                error
            );

            vscode.window.showErrorMessage(
                `Failed: ${path.basename(filePath)} - ${error.message}`
            );
        }
    }


    vscode.window.showInformationMessage(
        `Permission Manager: ${updated} updated, ${unchanged} unchanged, ${failed} failed.`
    );
}


/*
 * ============================================================
 * User ASSIGNMENTS
 * ============================================================
 */
async function handleUserPermission(filePaths) {

}



module.exports = {
    runPermissionManager
};
