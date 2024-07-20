import { codeMirror5Extension } from "./codeMirror5Extension";
import { codeMirror6Extension } from "./codeMirror6Extension";
import { ContentScriptContext } from "./types";

module.exports = {
	default: function(context: ContentScriptContext) {
		return {
			plugin: function(CodeMirror: any) {
				if (CodeMirror.cm6) {
					return codeMirror6Extension(CodeMirror, context);
				} else {
					return codeMirror5Extension(CodeMirror, context);
				}
			},
			codeMirrorResources: ['addon/mode/multiplex'],
			codeMirrorOptions: { 'enable-math-mode': true },
			assets: function() {
				return [
					{ mime: 'text/css',
						inline: true,
						text: `.math-result-line {
											opacity: 0.75;
											display: block;
										}
										.math-result-right {
											padding-right: 5px;
											text-align: right;
										}
										.math-input-inline {
											float: left;
										}
										.CodeMirror pre.CodeMirror-line.math-input-inline {
											padding-right: 10px;
										}
										.math-hidden {
											display: none;
										}
										.math-copy-button:hover {
											cursor: pointer;
										}
										.math-copy-tooltip {
											opacity: 0;
										}
										.math-copy-tooltip > svg{
											height: 1em;
											margin-left: 6px;
										}
										.math-copy-button:hover + .math-copy-tooltip {
											opacity: 1;
										}
										/* This will style math text to be the same as the notes text colour */
										.CodeMirror-line.math-input-line span.cm-comment {
											color: inherit;
										}
										.cm-mm-math-block {
										/* On macOS systems the line following a float: left will be aligned to the
										right. We don't want it to happen, so this is placed in which prevents
										top level lines from becoming wrapped up in the float */
											overflow: auto;
										}
							`
					}
				];
			},
		}
	},
}