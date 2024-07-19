import { ContentScriptContext } from "./types";
import { type Decoration, type DecorationSet, type EditorView, type ViewUpdate } from '@codemirror/view';
import { type Line } from '@codemirror/state';

import { requireCodeMirrorView, requireCodeMirrorState } from "./utils/codeMirror6Requires";
import { ExpressionLineData, lineDataEqual, LineDataType, process_all } from "./utils/mathUtils";
import { createResultElement } from "./utils/createResultElement";


export const codeMirror6Extension = async (editorControl: any, context: ContentScriptContext) => {
	const { ViewPlugin, Decoration, WidgetType } = requireCodeMirrorView();
	const { RangeSetBuilder } = requireCodeMirrorState();

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

	const globalConfig = await context.postMessage({name: 'getConfig'});
	const configDecoration = Decoration.line({
		attributes: { class: 'cm-comment cm-math-config' },
	});
	const inputHiddenDecoration = Decoration.line({
		attributes: { class: 'math-hidden' },
	});

	const createMathDecorations = (view: EditorView) => {
		// TODO: Only update visible expressions? (Use view.visibleRanges).
		const lines = view.state.doc.toString().split('\n');
		const lineData = process_all(lines, { globalConfig });

		const decorationBuilder = new RangeSetBuilder<Decoration>();
		const addLineDecoration = (line: Line, decoration: Decoration) => {
			decorationBuilder.add(line.from, line.from, decoration);
		};

		for (const { from, to } of view.visibleRanges) {
			const lineFrom = view.state.doc.lineAt(from);
			const lineTo = view.state.doc.lineAt(to);
			for (let i = lineFrom.number; i <= lineTo.number; i++) {
				const line = view.state.doc.line(i);
				const data = lineData[i - 1];
				if (!data) continue;

				if (data.type === LineDataType.Config) {
					addLineDecoration(line, configDecoration);
				} else {
					if (data.resultHidden) continue;
					if (data.inputHidden) {
						addLineDecoration(line, inputHiddenDecoration);
					}

					const resultWidgetDecoration = Decoration.widget({
						widget: new MathResultWidget(data),
						side: 1,
					});
					decorationBuilder.add(line.to, line.to, resultWidgetDecoration);
				}
			}
		}

		return decorationBuilder.finish();
	};

	const mathModeDecorator = ViewPlugin.fromClass(class {
		public decorations: DecorationSet;

		public constructor(view: EditorView) {
			this.decorations = createMathDecorations(view);
		}

		public update(update: ViewUpdate) {
			if (update.viewportChanged || update.docChanged) {
				this.decorations = createMathDecorations(update.view);
			}
		}
	}, { decorations: plugin => plugin.decorations });

	editorControl.addExtension([
		mathModeDecorator
	]);
}