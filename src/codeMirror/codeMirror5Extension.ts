import { get_exchange_rates } from '../exchangeRate'
import { ContentScriptContext } from './types';
import { process_all, trim_lines } from './utils/mathUtils';
import { equation_result_collapsed, equation_result_separator } from './constants';
import { createResultElement } from './utils/createResultElement';
const mathjs = require('mathjs');

export function codeMirror5Extension(CodeMirror: any, context: ContentScriptContext) {
	const math = mathjs.create(mathjs.all, {});

	function reprocess(cm: any) {
		const lines = cm.getValue('\n').split('\n');
		const lineData = process_all(lines, { globalConfig: cm.state.mathMode.globalConfig });

		cm.state.mathMode.lineData = lineData;

		refresh_widgets(cm);
	}

	function clear_math_widgets(cm: any, lineInfo: any) {
		// This could potentially cause a conflict with another plugin
		cm.removeLineClass(lineInfo.handle, 'wrap', 'cm-comment');

		if (lineInfo.widgets) {
			cm.removeLineClass(lineInfo.handle, 'text', 'math-hidden');
			cm.removeLineClass(lineInfo.handle, 'text', 'math-input-inline');
			cm.removeLineClass(lineInfo.handle, 'text', 'math-input-line');

			for (const wid of lineInfo.widgets) {
				if (wid.className === 'math-result-line')
					wid.clear();
			}
		}
	}

	function refresh_widgets(cm: any) {
		for (let i = cm.firstLine(); i <= cm.lastLine(); i++) {
			const line = cm.lineInfo(i);

			clear_math_widgets(cm, line);

			const lineData = cm.state.mathMode.lineData[i];

			if (!lineData) continue;

			if (lineData.isConfig) {
				cm.addLineClass(i, 'wrap', 'cm-comment');
				continue;
			}
			cm.addLineClass(i, 'wrap', 'cm-mm-math-block');

			if (lineData.resultHidden) continue;

			if (lineData.inputHidden)
				cm.addLineClass(i, 'text', 'math-hidden');
			else if (lineData.inline)
				cm.addLineClass(i, 'text', 'math-input-inline');

			const res = createResultElement(lineData);

			// handleMouseEvents gives control of mouse handling for the widget to codemirror
			// This is necessary to get the cursor to be placed in the right location ofter
			// clicking on a widget
			// The downside is that it breaks copying of widget text (for textareas, it never
			// works on contenteditable)
			// I'm okay with this because I want the user to be able to select a block
			// without accidently grabbing the result
			cm.addLineWidget(i, res, { className: 'math-result-line', handleMouseEvents: true });
			// This will be used to clear the colouring from cm-comment
			cm.addLineClass(i, 'text', 'math-input-line');
		}
	}

	function clean_up(cm: any, lines: string[]) {
		for (let i = 0; i < lines.length; i++) {
			if (!lines[i]) {
				const line = cm.lineInfo(i);

				clear_math_widgets(cm, line);
			}
		}
	}

	// On each change we're going to scan for
	function on_change(cm: any, change: any) {
		let lines = trim_lines(cm.getValue('\n').split('\n'), true);
		clean_up(cm, lines);
		// Most changes are the user typing a single character
		// If this doesn't happen inside a math block, we shouldn't re-process
		// +input means the user input the text (as opposed to joplin/plugin)
		// +delete means the user deleted some text
		// setValue means something programically altered the text
		if (change.from.line === change.to.line && change.origin !== "setValue") {
			const from = change.from.line;

			if (!lines[from] &&
				(from === cm.firstLine() || !lines[from - 1]) &&
				(from === cm.lastLine() || !lines[from + 1]))
				return;
		}

		if (cm.state.mathMode.timer)
			clearTimeout(cm.state.mathMode.timer);

		cm.state.mathMode.timer = setTimeout(() => {
		// Because the entire document shares one scope,
		// we will re-process the entire document for each change
			reprocess(cm);
			cm.state.mathMode.timer = null;
		}, 300);
	}

	function update_rates(cm: any) {
		get_exchange_rates().then(rates => {;
			math.createUnit(rates.base);
			math.createUnit(rates.base.toLowerCase(), math.unit(1, rates.base));
			Object.keys(rates.rates)
				.forEach((currency) => {
					math.createUnit(currency, math.unit(1/rates.rates[currency], rates.base));
					math.createUnit(currency.toLowerCase(), math.unit(1/rates.rates[currency], rates.base));
				});
			reprocess(cm);
		});
	}

	// I ran into an odd bug during development where the function wouldn't be called
	// when the default value of the option was true (only happened on some notes)
	// The fix for me was to set the option to true in codeMirrorOptions instead
	CodeMirror.defineOption('enable-math-mode', false, async function(cm: any, val: any, old: any) {
		// Cleanup
		if (old && old != CodeMirror.Init) {
			clearInterval(cm.state.mathMode.rateInterval);
			cm.state.mathMode = null;
			cm.off("change", on_change);
		}
		// setup
		if (val) {
			const globalConfig = await context.postMessage({name: 'getConfig'});

			let interval = null;
			if (globalConfig.currency) {
				interval = setInterval(() => { update_rates(cm); }, 1000*60*60*24);
			}

			cm.state.mathMode = {
				scope: {},
				rateInterval: interval,
				globalConfig: globalConfig,
				lineData: {},
			};

			if (globalConfig.currency) {
				update_rates(cm);
			}
			reprocess(cm);
			// We need to process all blocks on the next update
			cm.on('change', on_change);
		}
	});
}

