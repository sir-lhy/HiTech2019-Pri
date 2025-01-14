/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const rl = require("readline");
const util_1 = require("./util");
const testUtils_1 = require("./testUtils");
const goModules_1 = require("./goModules");
let gutterSvgs;
let decorators;
let decoratorConfig;
/**
 * Initializes the decorators used for Code coverage.
 * @param ctx The extension context
 */
function initCoverageDecorators(ctx) {
    // Initialize gutter svgs
    gutterSvgs = {
        blockred: ctx.asAbsolutePath('images/gutter-blockred.svg'),
        blockgreen: ctx.asAbsolutePath('images/gutter-blockgreen.svg'),
        blockblue: ctx.asAbsolutePath('images/gutter-blockblue.svg'),
        blockyellow: ctx.asAbsolutePath('images/gutter-blockyellow.svg'),
        slashred: ctx.asAbsolutePath('images/gutter-slashred.svg'),
        slashgreen: ctx.asAbsolutePath('images/gutter-slashgreen.svg'),
        slashblue: ctx.asAbsolutePath('images/gutter-slashblue.svg'),
        slashyellow: ctx.asAbsolutePath('images/gutter-slashyellow.svg'),
        verticalred: ctx.asAbsolutePath('images/gutter-vertred.svg'),
        verticalgreen: ctx.asAbsolutePath('images/gutter-vertgreen.svg'),
        verticalblue: ctx.asAbsolutePath('images/gutter-vertblue.svg'),
        verticalyellow: ctx.asAbsolutePath('images/gutter-vertyellow.svg')
    };
    let editor = vscode.window.activeTextEditor;
    // Update the coverageDecorator in User config, if they are using the old style.
    const goConfig = vscode.workspace.getConfiguration('go', editor ? editor.document.uri : null);
    const inspectResult = goConfig.inspect('coverageDecorator');
    if (typeof inspectResult.globalValue === 'string') {
        goConfig.update('coverageDecorator', { type: inspectResult.globalValue }, vscode.ConfigurationTarget.Global);
    }
    if (typeof inspectResult.workspaceValue === 'string') {
        goConfig.update('coverageDecorator', { type: inspectResult.workspaceValue }, vscode.ConfigurationTarget.Workspace);
    }
    if (typeof inspectResult.workspaceFolderValue === 'string') {
        goConfig.update('coverageDecorator', { type: inspectResult.workspaceValue }, vscode.ConfigurationTarget.WorkspaceFolder);
    }
    // Update the decorators
    updateCodeCoverageDecorators(goConfig.get('coverageDecorator'));
}
exports.initCoverageDecorators = initCoverageDecorators;
/**
 * Updates the decorators used for Code coverage.
 * @param coverageDecoratorConfig The coverage decorated as configured by the user
 */
function updateCodeCoverageDecorators(coverageDecoratorConfig) {
    // These defaults are chosen to be distinguishable in nearly any color scheme (even Red)
    // as well as by people who have difficulties with color perception.
    decoratorConfig = {
        type: 'highlight',
        coveredHighlightColor: 'rgba(64,128,128,0.5)',
        uncoveredHighlightColor: 'rgba(128,64,64,0.25)',
        coveredGutterStyle: 'blockblue',
        uncoveredGutterStyle: 'slashyellow'
    };
    // Update from configuration
    if (typeof (coverageDecoratorConfig) === 'string') {
        decoratorConfig.type = coverageDecoratorConfig;
    }
    else {
        for (let k in coverageDecoratorConfig) {
            decoratorConfig[k] = coverageDecoratorConfig[k];
        }
    }
    setDecorators();
}
exports.updateCodeCoverageDecorators = updateCodeCoverageDecorators;
function setDecorators() {
    disposeDecorators();
    decorators = {
        type: decoratorConfig.type,
        coveredGutterDecorator: vscode.window.createTextEditorDecorationType({ gutterIconPath: gutterSvgs[decoratorConfig.coveredGutterStyle] }),
        uncoveredGutterDecorator: vscode.window.createTextEditorDecorationType({ gutterIconPath: gutterSvgs[decoratorConfig.uncoveredGutterStyle] }),
        coveredHighlightDecorator: vscode.window.createTextEditorDecorationType({ backgroundColor: decoratorConfig.coveredHighlightColor }),
        uncoveredHighlightDecorator: vscode.window.createTextEditorDecorationType({ backgroundColor: decoratorConfig.uncoveredHighlightColor })
    };
}
/**
 * Disposes decorators so that the current coverage is removed from the editor.
 */
function disposeDecorators() {
    if (decorators) {
        decorators.coveredGutterDecorator.dispose();
        decorators.uncoveredGutterDecorator.dispose();
        decorators.coveredHighlightDecorator.dispose();
        decorators.uncoveredHighlightDecorator.dispose();
    }
}
let coverageFiles = {};
let isCoverageApplied = false;
/**
 * Clear the coverage on all files
 */
function clearCoverage() {
    coverageFiles = {};
    disposeDecorators();
    isCoverageApplied = false;
}
/**
 * Extract the coverage data from the given cover profile & apply them on the files in the open editors.
 * @param coverProfilePath Path to the file that has the cover profile data
 * @param packageDirPath Absolute path of the package for which the coverage was calculated
 */
function applyCodeCoverageToAllEditors(coverProfilePath, packageDirPath) {
    return new Promise((resolve, reject) => {
        try {
            // Clear existing coverage files
            clearCoverage();
            let lines = rl.createInterface({
                input: fs.createReadStream(coverProfilePath),
                output: undefined
            });
            lines.on('line', function (data) {
                // go test coverageprofile generates output:
                //    filename:StartLine.StartColumn,EndLine.EndColumn Hits CoverCount
                // The first line will be "mode: set" which will be ignored
                let fileRange = data.match(/([^:]+)\:([\d]+)\.([\d]+)\,([\d]+)\.([\d]+)\s([\d]+)\s([\d]+)/);
                if (!fileRange)
                    return;
                let filePath = path.join(packageDirPath, path.basename(fileRange[1]));
                let coverage = getCoverageData(filePath);
                let range = new vscode.Range(
                // Start Line converted to zero based
                parseInt(fileRange[2]) - 1, 
                // Start Column converted to zero based
                parseInt(fileRange[3]) - 1, 
                // End Line converted to zero based
                parseInt(fileRange[4]) - 1, 
                // End Column converted to zero based
                parseInt(fileRange[5]) - 1);
                // If is Covered (CoverCount > 0)
                if (parseInt(fileRange[7]) > 0) {
                    coverage.coveredRange.push(range);
                }
                // Not Covered
                else {
                    coverage.uncoveredRange.push(range);
                }
                setCoverageData(filePath, coverage);
            });
            lines.on('close', () => {
                vscode.window.visibleTextEditors.forEach(applyCodeCoverage);
                resolve();
            });
        }
        catch (e) {
            vscode.window.showInformationMessage(e.msg);
            reject(e);
        }
    });
}
exports.applyCodeCoverageToAllEditors = applyCodeCoverageToAllEditors;
/**
 * Get the object that holds the coverage data for given file path.
 * @param filePath
 */
function getCoverageData(filePath) {
    if (filePath.startsWith('_')) {
        filePath = filePath.substr(1);
    }
    if (process.platform === 'win32') {
        const parts = filePath.split('/');
        if (parts.length) {
            filePath = parts.join(path.sep);
        }
    }
    return coverageFiles[filePath] || { coveredRange: [], uncoveredRange: [] };
}
/**
 * Set the object that holds the coverage data for given file path.
 * @param filePath
 * @param data
 */
function setCoverageData(filePath, data) {
    if (filePath.startsWith('_')) {
        filePath = filePath.substr(1);
    }
    if (process.platform === 'win32') {
        const parts = filePath.split('/');
        if (parts.length) {
            filePath = parts.join(path.sep);
        }
    }
    coverageFiles[filePath] = data;
}
/**
 * Apply the code coverage highlighting in given editor
 * @param editor
 */
function applyCodeCoverage(editor) {
    if (!editor || editor.document.languageId !== 'go' || editor.document.fileName.endsWith('_test.go')) {
        return;
    }
    const cfg = vscode.workspace.getConfiguration('go', editor.document.uri);
    const coverageOptions = cfg['coverageOptions'];
    setDecorators();
    for (let filename in coverageFiles) {
        if (editor.document.uri.fsPath.endsWith(filename)) {
            isCoverageApplied = true;
            const coverageData = coverageFiles[filename];
            if (coverageOptions === 'showCoveredCodeOnly' || coverageOptions === 'showBothCoveredAndUncoveredCode') {
                editor.setDecorations(decorators.type === 'gutter' ? decorators.coveredGutterDecorator : decorators.coveredHighlightDecorator, coverageData.coveredRange);
            }
            if (coverageOptions === 'showUncoveredCodeOnly' || coverageOptions === 'showBothCoveredAndUncoveredCode') {
                editor.setDecorations(decorators.type === 'gutter' ? decorators.uncoveredGutterDecorator : decorators.uncoveredHighlightDecorator, coverageData.uncoveredRange);
            }
        }
    }
}
exports.applyCodeCoverage = applyCodeCoverage;
/**
 * Listener for change in the editor.
 * A change in a Go file means the coverage data is stale. Therefore it should be cleared.
 * @param e TextDocumentChangeEvent
 */
function removeCodeCoverageOnFileChange(e) {
    if (e.document.languageId !== 'go' || !e.contentChanges.length || !isCoverageApplied) {
        return;
    }
    if (vscode.window.visibleTextEditors.every(editor => editor.document !== e.document)) {
        return;
    }
    if (isPartOfComment(e)) {
        return;
    }
    clearCoverage();
}
exports.removeCodeCoverageOnFileChange = removeCodeCoverageOnFileChange;
/**
 * If current editor has Code coverage applied, then remove it.
 * Else run tests to get the coverage and apply.
 */
function toggleCoverageCurrentPackage() {
    let editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showInformationMessage('No editor is active.');
        return;
    }
    if (isCoverageApplied) {
        clearCoverage();
        return;
    }
    let goConfig = vscode.workspace.getConfiguration('go', editor.document.uri);
    let cwd = path.dirname(editor.document.uri.fsPath);
    let args = testUtils_1.getTestFlags(goConfig);
    let tmpCoverPath = util_1.getTempFilePath('go-code-cover');
    args.push('-coverprofile=' + tmpCoverPath);
    const testConfig = {
        goConfig: goConfig,
        dir: cwd,
        flags: args,
        background: true
    };
    return goModules_1.isModSupported(editor.document.uri).then(isMod => {
        testConfig.isMod = isMod;
        return testUtils_1.goTest(testConfig).then(success => {
            if (!success) {
                testUtils_1.showTestOutput();
            }
            return applyCodeCoverageToAllEditors(tmpCoverPath, testConfig.dir);
        });
    });
}
exports.toggleCoverageCurrentPackage = toggleCoverageCurrentPackage;
function isPartOfComment(e) {
    return e.contentChanges.every(change => {
        // We cannot be sure with using just regex on individual lines whether a multi line change is part of a comment or not
        // So play it safe and treat it as not a comment
        if (!change.range.isSingleLine || change.text.includes('\n')) {
            return false;
        }
        const text = e.document.lineAt(change.range.start).text;
        const idx = text.search('//');
        return (idx > -1 && idx <= change.range.start.character);
    });
}
exports.isPartOfComment = isPartOfComment;
//# sourceMappingURL=goCover.js.map