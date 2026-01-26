"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
// Decoration type - created once, reused for all decorations
let decorationType;
// Debounce timer for document changes
let debounceTimer;
const DEBOUNCE_MS = 100;
// Current pattern (from config or default)
let highlightPattern;
function activate(context) {
    console.log('[Highlighter] Extension activating...');
    // Create the decoration type once
    decorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(0, 200, 0, 0.4)',
        border: '1px solid green',
        borderRadius: '2px',
        // Green text as fallback/addition
        color: 'lightgreen',
        fontWeight: 'bold'
    });
    context.subscriptions.push(decorationType);
    // Load initial pattern from config
    loadPatternFromConfig();
    // Register event listeners
    context.subscriptions.push(
    // Immediate update when active editor changes
    vscode.window.onDidChangeActiveTextEditor((editor) => {
        console.log('[Highlighter] Active editor changed');
        if (editor) {
            updateDecorations(editor);
        }
    }), 
    // Immediate update when visible editors change (split view)
    vscode.window.onDidChangeVisibleTextEditors((editors) => {
        console.log('[Highlighter] Visible editors changed, count:', editors.length);
        editors.forEach(updateDecorations);
    }), 
    // Debounced update on document changes
    vscode.workspace.onDidChangeTextDocument((event) => {
        const editor = vscode.window.visibleTextEditors.find((e) => e.document === event.document);
        if (editor) {
            console.log('[Highlighter] Document changed, debouncing update...');
            debounceUpdate(editor);
        }
    }), 
    // Update when configuration changes
    vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('accessibilityHighlighter')) {
            console.log('[Highlighter] Configuration changed');
            loadPatternFromConfig();
            updateAllVisibleEditors();
        }
    }));
    // Initial update for all visible editors
    console.log('[Highlighter] Running initial decoration pass...');
    updateAllVisibleEditors();
    console.log('[Highlighter] Extension activated successfully');
}
function loadPatternFromConfig() {
    const config = vscode.workspace.getConfiguration('accessibilityHighlighter');
    const patternString = config.get('pattern', 'a(?=bc)');
    try {
        highlightPattern = new RegExp(patternString, 'g');
        console.log('[Highlighter] Pattern loaded:', patternString);
    }
    catch (e) {
        console.error('[Highlighter] Invalid regex pattern, using default');
        highlightPattern = /a(?=dc)/g;
    }
}
function debounceUpdate(editor) {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
        updateDecorations(editor);
    }, DEBOUNCE_MS);
}
function updateAllVisibleEditors() {
    const config = vscode.workspace.getConfiguration('accessibilityHighlighter');
    if (!config.get('enabled', true)) {
        console.log('[Highlighter] Disabled, clearing all decorations');
        vscode.window.visibleTextEditors.forEach((editor) => {
            editor.setDecorations(decorationType, []);
        });
        return;
    }
    vscode.window.visibleTextEditors.forEach(updateDecorations);
}
function updateDecorations(editor) {
    const config = vscode.workspace.getConfiguration('accessibilityHighlighter');
    if (!config.get('enabled', true)) {
        editor.setDecorations(decorationType, []);
        return;
    }
    const document = editor.document;
    const text = document.getText();
    const decorations = [];
    // Reset regex lastIndex for fresh matching
    highlightPattern.lastIndex = 0;
    let match;
    let matchCount = 0;
    const MAX_MATCHES = 1000; // Safety limit for large files
    while ((match = highlightPattern.exec(text)) !== null) {
        if (matchCount >= MAX_MATCHES) {
            console.log('[Highlighter] Max matches reached, stopping');
            break;
        }
        const startPos = document.positionAt(match.index);
        const endPos = document.positionAt(match.index + match[0].length);
        const range = new vscode.Range(startPos, endPos);
        decorations.push({
            range,
            hoverMessage: `Matched: "${match[0]}"`
        });
        matchCount++;
        // Prevent infinite loop on zero-length matches
        if (match[0].length === 0) {
            highlightPattern.lastIndex++;
        }
    }
    editor.setDecorations(decorationType, decorations);
    console.log(`[Highlighter] Applied ${matchCount} decorations to ${document.fileName}`);
}
function deactivate() {
    console.log('[Highlighter] Extension deactivating...');
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
    // decorationType is disposed automatically via context.subscriptions
}
//# sourceMappingURL=extension.js.map