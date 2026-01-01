import { ContentScriptContext, GlobalConfig } from "../shared/types";
import type { Decoration, DecorationSet } from '@codemirror/view';
import type { Text } from '@codemirror/state';

import { require_codemirror_view, require_codemirror_state, require_codemirror_language } from "./utils/requires";
import { ExpressionLineData, lineDataEqual, LineDataType, process_all } from "../shared/utils/mathUtils";
import { create_result_element } from "./utils/create_result_element";
import { update_rates } from "../shared/utils/update_rates";
import { block_math_regex, inline_math_regex } from "../shared/constants";


export const codeMirror6Extension = async (editorControl: any, context: ContentScriptContext) => {
	const { Decoration, WidgetType, EditorView } = require_codemirror_view();
	const { RangeSetBuilder, StateField, StateEffect } = require_codemirror_state();
	const { syntaxTree } = require_codemirror_language();

	class MathResultWidget extends WidgetType {
		public constructor(private lineData: ExpressionLineData, private config: GlobalConfig) {
			super();
		}

		public eq(other: MathResultWidget) {
			return lineDataEqual(this.lineData, other.lineData);
		}

		public toDOM() {
			return create_result_element(this.lineData, this.config);
		}
	}

	const config_decoration = Decoration.line({
		attributes: { class: 'cm-comment cm-math-config' },
	});
	const input_hidden_decoration = Decoration.mark({
		attributes: { class: 'math-hidden' },
	});
	const input_inline_decoration = Decoration.mark({
		attributes: { class: 'math-input-inline' },
	});
	const inline_container_decoration = Decoration.line({
		attributes: { class: 'math-container-inline' },
	});

	const global_config = await context.postMessage({name: 'getConfig'});
	const build_decorations = (doc: Text) => {
		const lines = doc.toString().split('\n');
		const line_data = process_all(lines, { globalConfig: global_config });

		const decoration_builder = new RangeSetBuilder<Decoration>();
		for (let i = 1; i <= doc.lines; i++) {
			const line = doc.line(i);
			const data = line_data[i - 1];
			if (!data) continue;

			if (data.type === LineDataType.Config) {
				decoration_builder.add(line.from, line.from, config_decoration);
			} else {
				if (data.resultHidden) continue;
				if (data.inputHidden) {
					decoration_builder.add(line.from, line.to, input_hidden_decoration);
				} else if (data.inline) {
					decoration_builder.add(line.from, line.from, inline_container_decoration);
					decoration_builder.add(line.from, line.to, input_inline_decoration);
				}

				const result_widget_decoration = Decoration.widget({
					widget: new MathResultWidget(data, global_config),
					side: 1,
					block: !data.inline,
				});

				decoration_builder.add(line.to, line.to, result_widget_decoration);
			}
		}
		return decoration_builder.finish();
	};

	// Can be `.dispatch`ed to force math to refresh.
	const force_refresh_effect = StateEffect.define<boolean>({});

	// An editor extension that handles decoration refresh.
	// See https://codemirror.net/examples/decoration/
	const decorations_field = StateField.define<DecorationSet>({
		create: (state) => build_decorations(state.doc),
		update: (decorations, tr) => {
			decorations = decorations.map(tr.changes);
			let needs_refresh = false;
			if (tr.reconfigured || tr.effects.some(c => c.is(force_refresh_effect))) {
				needs_refresh = true;
			} else if (tr.docChanged) {
				// from_b, to_b: Positions in the new document.
				tr.changes.iterChangedRanges((from_a, to_a, from_b, to_b) => {
					if (needs_refresh) return;

					const from_line = tr.newDoc.lineAt(from_b);
					const to_line = tr.newDoc.lineAt(to_b);

					let hasOverlap = false;
					decorations.between(from_line.from, to_line.to, () => {
						hasOverlap = true;
						return false;
					});

					needs_refresh ||= hasOverlap;

					// Handles the case where a user starts a new math region
					if (!needs_refresh) {
						needs_refresh = !!from_line.text.match(inline_math_regex) || !!from_line.text.match(block_math_regex);
					}

					if (!needs_refresh) {
						const new_text = tr.newDoc.sliceString(from_b, to_b);
						// Handles the case where a ```math block is pasted into the document:
						needs_refresh = !!new_text.match(block_math_regex);
					}

					// Handles the case where a user deletes a math region
					if (!needs_refresh) {
						const old_text = tr.startState.doc.sliceString(from_a, to_a);
						needs_refresh = !!old_text.match(block_math_regex) || !!old_text.match(inline_math_regex);
					}

					// Handles the case where a line within a ```math block is edited.
					if (!needs_refresh) {
						syntaxTree(tr.startState).iterate({
							from: from_a, to: to_a,
							enter: node => {
								if (node.name === 'FencedCode') {
									const fromLine = tr.startState.doc.lineAt(node.from);
									needs_refresh ||= !!fromLine.text.match(block_math_regex);
								}

								// Search until needs_refresh is true.
								return !needs_refresh;
							},
						});
					}
				});
			}

			if (needs_refresh) {
				return build_decorations(tr.newDoc);
			} else {
				return decorations;
			}
		},
		provide: field => EditorView.decorations.from(field),
	});

	editorControl.addExtension([
		decorations_field,
		EditorView.baseTheme({
			'& .math-container-inline.cm-line': {
				display: 'flex',
				flexDirection: 'row',
				flexWrap: 'wrap',
			},
			'& .math-result': {
				flexGrow: 1,
				opacity: 0.7,
				pointerEvents: 'none',
			},
			'& .math-result > *': {
				pointerEvents: 'auto',
			},

			'& .math-result.math-result-right.math-inline': {
				// Right-align the text (or left-align if right-to-left is enabled)
				textAlign: 'inline-end',
			},

			// Override the CM5 styles (which are also applied to CM6)
			'& .math-input-inline, & .math-result': {
				float: 'none',
			},
			'& .math-result.math-inline': {
				display: 'inline',
			},
			// Copy some of the copy-tooltop css here so that it works in the popped out windows
			'& .math-result .math-copy-tooltip': {
				opacity: 0,
				transition: 'opacity 0.2s ease',
			},
			'& .math-result .math-copy-tooltip > svg': {
				height: '1em',
				marginLeft: '6px',
				display: 'inline-block',
			},
			'& .math-copy-button:hover': {
				cursor: 'pointer',
			},
			'& .math-copy-button:hover + .math-copy-tooltip': {
				opacity: '1',
			},
		}),
	]);

	if (global_config.currency) {
		const update_rates_and_rerender = () => {
			update_rates().then(() => {
				editorControl.editor.dispatch({
					effects: [ force_refresh_effect.of(true) ]
				});
			}).catch(err => {
				console.error('Failed to update exchange rates:', err);
			});
		};
		update_rates_and_rerender();
	}
}