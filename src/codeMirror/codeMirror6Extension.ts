import { ContentScriptContext } from "./types";
import type { Decoration, DecorationSet } from '@codemirror/view';
import type { Text } from '@codemirror/state';

import { requireCodeMirrorView, requireCodeMirrorState } from "./utils/codeMirror6Requires";
import { ExpressionLineData, lineDataEqual, LineDataType, process_all } from "./utils/mathUtils";
import { createResultElement } from "./utils/createResultElement";
import { updateRates } from "./utils/updateRates";
import { inline_math_regex } from "./constants";


export const codeMirror6Extension = async (editorControl: any, context: ContentScriptContext) => {
	const { Decoration, WidgetType, EditorView } = requireCodeMirrorView();
	const { RangeSetBuilder, StateField, StateEffect } = requireCodeMirrorState();

	class MathResultWidget extends WidgetType {
		public constructor(private lineData: ExpressionLineData) {
			super();
		}

		public eq(other: MathResultWidget) {
			return lineDataEqual(this.lineData, other.lineData);
		}

		public toDOM() {
			return createResultElement(this.lineData);
		}
	}

	const configDecoration = Decoration.line({
		attributes: { class: 'cm-comment cm-math-config' },
	});
	const inputHiddenDecoration = Decoration.mark({
		attributes: { class: 'math-hidden' },
	});
	const inputInlineDecoration = Decoration.mark({
		attributes: { class: 'math-input-inline' },
	});
	const inlineContainerDecoration = Decoration.line({
		attributes: { class: 'math-container-inline' },
	});

	const globalConfig = await context.postMessage({name: 'getConfig'});
	const buildDecorations = (doc: Text) => {
		const lines = doc.toString().split('\n');
		const lineData = process_all(lines, { globalConfig });

		const decorationBuilder = new RangeSetBuilder<Decoration>();
		for (let i = 1; i <= doc.lines; i++) {
			const line = doc.line(i);
			const data = lineData[i - 1];
			if (!data) continue;

			if (data.type === LineDataType.Config) {
				decorationBuilder.add(line.from, line.from, configDecoration);
			} else {
				if (data.resultHidden) continue;
				if (data.inputHidden) {
					decorationBuilder.add(line.from, line.to, inputHiddenDecoration);
				} else if (data.inline) {
					decorationBuilder.add(line.from, line.from, inlineContainerDecoration);
					decorationBuilder.add(line.from, line.to, inputInlineDecoration);
				}

				const resultWidgetDecoration = Decoration.widget({
					widget: new MathResultWidget(data),
					side: 1,
					block: !data.inline,
				});

				decorationBuilder.add(line.to, line.to, resultWidgetDecoration);
			}
		}
		return decorationBuilder.finish();
	};

	const forceRefresh = StateEffect.define<boolean>({});

	// See https://codemirror.net/examples/decoration/
	const decorationsField = StateField.define<DecorationSet>({
		create: (state) => buildDecorations(state.doc),
		update: (decorations, tr) => {
			decorations = decorations.map(tr.changes);
			let needsRefresh = false;
			if (tr.reconfigured || tr.effects.some(c => c.is(forceRefresh))) {
				needsRefresh = true;
			} else if (tr.docChanged) {
				// fromB, toB: Positions in the new document.
				tr.changes.iterChangedRanges((_fromA, _toA, fromB, toB) => {
					if (needsRefresh) return;

					const fromLine = tr.newDoc.lineAt(fromB);
					const toLine = tr.newDoc.lineAt(toB);

					let hasOverlap = false;
					decorations.between(fromLine.from, toLine.to, () => {
						hasOverlap = true;
						return false;
					});

					needsRefresh ||= hasOverlap;

					// Handles the case where a user starts a new math region
					if (!needsRefresh) {
						needsRefresh = !!fromLine.text.match(inline_math_regex);
					}
				});
			}

			if (needsRefresh) {
				return buildDecorations(tr.newDoc);
			} else {
				return decorations;
			}
		},
		provide: field => EditorView.decorations.from(field),
	});

	editorControl.addExtension([
		decorationsField,
		EditorView.baseTheme({
			'& .math-result-right.math-inline': {
				display: 'inline-block',
				float: 'inline-end',
				textAlign: 'inline-end',
			},
			'& .math-input-inline': {
				float: 'none',
			},
			'& .math-container-inline': {
				// Prevent the result from overlapping the next line
				display: 'flow-root',
			},
			'& .math-result': {
				opacity: 0.7,
			}
		}),
	]);

	if (globalConfig.currency) {
		const updateRatesAndRerender = () => {
			updateRates().then(() => {
				editorControl.editor.dispatch({
					effects: [ forceRefresh.of(true) ]
				});
			});
		};
		updateRatesAndRerender();
	}
}