import type * as CodeMirrorView from '@codemirror/view';
import type * as CodeMirrorState from '@codemirror/state';

// Dynamically imports a CodeMirror 6 library. This is done
// to allow the plugin to start in both CodeMirror 5 and CodeMirror 6
// without import failure errors.
export function requireCodeMirrorView(): typeof CodeMirrorView {
	return require('@codemirror/view');
}

export function requireCodeMirrorState(): typeof CodeMirrorState {
	return require('@codemirror/state');
}

