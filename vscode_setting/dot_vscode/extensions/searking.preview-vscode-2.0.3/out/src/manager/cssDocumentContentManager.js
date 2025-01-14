"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const htmlUtil_1 = require("./../utils/htmlUtil");
class CssDocumentContentManager {
    constructor(editor) {
        this._editor = editor;
        return this;
    }
    // @Override
    editor() {
        return this._editor;
    }
    // 生成当前编辑页面的可预览代码片段
    // @Override
    createContentSnippet() {
        return __awaiter(this, void 0, void 0, function* () {
            let editor = this._editor;
            if (!editor) {
                return htmlUtil_1.HtmlUtil.errorSnippet(this.getWindowErrorMessage());
            }
            let previewSnippet = this.generatePreviewSnippet(editor);
            if (!previewSnippet || previewSnippet.length <= 0) {
                return htmlUtil_1.HtmlUtil.errorSnippet(this.getErrorMessage());
            }
            console.info("previewSnippet = " + previewSnippet);
            return previewSnippet;
        });
    }
    // @Override
    sendPreviewCommand(previewUri, displayColumn) {
        return htmlUtil_1.HtmlUtil.sendPreviewCommand(previewUri, displayColumn);
    }
    getErrorMessage() {
        return `Active editor doesn't show a CSS document - no properties to preview.`;
    }
    getWindowErrorMessage() {
        return `No Active editor - no properties to preview.`;
    }
    CSSSampleFullSnippet(properties) {
        return htmlUtil_1.HtmlUtil.createRemoteSource(htmlUtil_1.SourceType.CUSTOM_STYLE_SAMPLE, properties);
    }
    getSelectedCSSProperity(editor) {
        if (!editor || !editor.document) {
            return htmlUtil_1.HtmlUtil.errorSnippet(this.getWindowErrorMessage());
        }
        // 获取当前页面文本
        let text = editor.document.getText();
        // 获取当前鼠标选中段落的起始位置        
        let startPosOfSelectionText = editor.document.offsetAt(editor.selection.anchor);
        let startPosOfCSSProperty = text.lastIndexOf('{', startPosOfSelectionText);
        let endPosOfCSSProperty = text.indexOf('}', startPosOfCSSProperty);
        if (startPosOfCSSProperty === -1 || endPosOfCSSProperty === -1) {
            return htmlUtil_1.HtmlUtil.errorSnippet("Cannot determine the rule's properties.");
        }
        var properties = text.slice(startPosOfCSSProperty + 1, endPosOfCSSProperty);
        return properties;
    }
    // 生成预览编辑页面
    generatePreviewSnippet(editor) {
        if (!editor) {
            return htmlUtil_1.HtmlUtil.errorSnippet(this.getWindowErrorMessage());
        }
        var cssProperty = this.getSelectedCSSProperity(editor);
        if (!cssProperty || cssProperty.length <= 0) {
            return htmlUtil_1.HtmlUtil.errorSnippet(this.getErrorMessage());
        }
        return this.CSSSampleFullSnippet(cssProperty);
    }
}
exports.CssDocumentContentManager = CssDocumentContentManager;
//# sourceMappingURL=cssDocumentContentManager.js.map