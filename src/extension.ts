import * as vscode from 'vscode';

// Decoration type - created once, reused for all decorations
let decorationType: vscode.TextEditorDecorationType;

// Debounce timer for document changes
let debounceTimer: NodeJS.Timeout | undefined;
const DEBOUNCE_MS = 100;

// Current pattern (from config or default)
let highlightPattern: RegExp;

export function activate(context: vscode.ExtensionContext) {
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
            const editor = vscode.window.visibleTextEditors.find(
                (e) => e.document === event.document
            );
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
        })
    );

    // Initial update for all visible editors
    console.log('[Highlighter] Running initial decoration pass...');
    updateAllVisibleEditors();

    console.log('[Highlighter] Extension activated successfully');
}

function loadPatternFromConfig(): void {
    const config = vscode.workspace.getConfiguration('accessibilityHighlighter');
    const patternString = config.get<string>('pattern', 'a(?=bc)');

    try {
        highlightPattern = new RegExp(patternString, 'g');
        console.log('[Highlighter] Pattern loaded:', patternString);
    } catch (e) {
        console.error('[Highlighter] Invalid regex pattern, using default');
        highlightPattern = /a(?=bc)/g;
    }
}

function debounceUpdate(editor: vscode.TextEditor): void {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
        updateDecorations(editor);
    }, DEBOUNCE_MS);
}

function updateAllVisibleEditors(): void {
    const config = vscode.workspace.getConfiguration('accessibilityHighlighter');
    if (!config.get<boolean>('enabled', true)) {
        console.log('[Highlighter] Disabled, clearing all decorations');
        vscode.window.visibleTextEditors.forEach((editor) => {
            editor.setDecorations(decorationType, []);
        });
        return;
    }

    vscode.window.visibleTextEditors.forEach(updateDecorations);
}

function updateDecorations(editor: vscode.TextEditor): void {
    const config = vscode.workspace.getConfiguration('accessibilityHighlighter');
    if (!config.get<boolean>('enabled', true)) {
        editor.setDecorations(decorationType, []);
        return;
    }

    const document = editor.document;
    const text = document.getText();
    const decorations: vscode.DecorationOptions[] = [];

    // Reset regex lastIndex for fresh matching
    highlightPattern.lastIndex = 0;

    let match: RegExpExecArray | null;
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

export function deactivate() {
    console.log('[Highlighter] Extension deactivating...');
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
    // decorationType is disposed automatically via context.subscriptions
}
