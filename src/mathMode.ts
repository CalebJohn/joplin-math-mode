import { get_exchange_rates } from './exchangeRate'
const mathjs = require('mathjs');

interface PluginState {
	scope: object;
	globalConfig: object;
	lineData: object;
};

type BlockType = '+' | '-';

const inline_math_regex = /^(\+|\-)?=(?=[^=])/;
const equation_result_separator = " => ";
const equation_result_collapsed = " |> ";

function plugin(CodeMirror) {
	CodeMirror.defineMode('joplin-literate-math', (config) => {
		return CodeMirror.multiplexingMode(
			// joplin-markdown is the CodeMirror mode that joplin uses
			// the inner style (cm-math-line) isn't used yet, but
			// I may do something with it in the future
			CodeMirror.getMode(config, { name: 'joplin-markdown' }),
			{open: "```math", close: "```",
				mode: CodeMirror.getMode(config, { name: 'joplin-inner-math' }),
				delimStyle: 'comment', innerStyle: 'math-line'}
  );
	});

	// Eventually we want to set this based on the Joplin settings
	const defaultConfig = {
		global: 'no',
		simplify: 'no',
		bignumber: 'no',
		displaytotal: 'no',
		hide: 'no',
		verbose: 'yes',
		inline: 'yes',
		notation: 'auto',
		precision: '4',
		align: 'left',
	};

	const math = mathjs.create(mathjs.all, {});

	function truthy(s: string) {
		s = s.toLowerCase();
		return s.startsWith('t') || s.startsWith('y') || s === '1';
	}

	function falsey(s: string) {
		s = s.toLowerCase();
		return s.startsWith('f') || s.startsWith('n') || s === '0';
	}

	// Helper for the math lines function,
	// removes all lines until the ```math symbol
	function erase_to_start(lines: string[], lineno: number) {
		for (let i = lineno; i >= 0; i--) {
			const line = lines[i];
			if (!line) continue;

			if (line.trim() === '```math') {
				break;
			}
			else if (!line.match(inline_math_regex)) {
				lines[i] = '';
			}
		}
	}

	// Takes in an array of all lines, and strips out any non-math lines
	function trim_lines(lines: string[]) {
		let might_be_in_block = false;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (!line) continue;

			if (line.match(inline_math_regex)) {
				continue;
			}
			else if (might_be_in_block && line.trim() === '```') {
				might_be_in_block = false;
				lines[i] = '```';
				continue;
			}
			else if (line.trim() === '```math') {
				might_be_in_block = true;
				lines[i] = '';
			}
			
			if (!might_be_in_block)
				lines[i] = '';
		}
		if (might_be_in_block) {
			erase_to_start(lines, lines.length);
		}

		return lines;
	}

	function reprocess(cm: any) {
		const lines = trim_lines(cm.getValue('\n').split('\n'));

		// scope is global to the note
		let scope = Object.assign({}, cm.state.mathMode.scope);
		let lineData = {};
		let globalConfig = Object.assign({}, cm.state.mathMode.globalConfig);
		let config = Object.assign({}, defaultConfig);
		let block_total = '';
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			if (!line) {
				block_total = '';
			}
			else if (line === '```') {
				config = Object.assign({}, globalConfig);
				block_total = '';
			}
			else if (line.includes(':')) {
				lineData[i] = process_config(line, config);
			}
			else {
				// Allow the user to redefine the total variable if they want
				const localScope = Object.assign({total: block_total}, scope);
				lineData[i] = process_line(line, localScope, config, block_total);
				// Update the scope
				scope = Object.assign(scope, localScope);
				block_total = lineData[i].total;
			}

			if (truthy(config.global)) {
				globalConfig = Object.assign(globalConfig, config, {global: 'false'});
			}
		}

		cm.state.mathMode.lineData = lineData;

		refresh_widgets(cm);
	}

	function get_line_equation(line: string): string {
		return line.replace(inline_math_regex, '');
	}

	function get_sum_type(line: string): BlockType {
		const match = inline_math_regex.exec(line)

		if (match && match.length > 1 && match[1] === '-')
			return '-';

		return '+';
	}

	function math_contains_assignment(parsed: any, name: string) {
		const filtered = parsed.filter(function (n) {
			return n.isAssignmentNode && n.name === name
		});

		return filtered.length > 0;
	}

	function math_contains_symbol(parsed: any, name: string) {
		const filtered = parsed.filter(function (n) {
			return n.isSymbolNode && n.name === name
		});

		return filtered.length > 0;
	}

	function process_line(line: string, scope: any, config: any, block_total: string): any {
		let result = '';
		let contains_total = false;

		try {
			const p = math.parse(get_line_equation(line));

			// Evaluate the Expression
			if (falsey(config.simplify))
				result = p.evaluate(scope);
			else
				result = math.simplify(p)

			contains_total = math_contains_symbol(p, 'total');
			if (result && !contains_total) {
				const sum_char = get_sum_type(line);
				// An error can occur when the types don't match up
				// To revocer, restart the sum counter
				try {
					block_total = math.parse(`${block_total} ${block_total!=='' ? sum_char: ''} ${result}`).evaluate(scope);
				}
				catch(err) {
					block_total = result;
				}
			}

			// If the sum variable wasn't modified, clear it
			if (!math_contains_assignment(p, 'total'))
				delete scope['total'];

			// Format the output
			result = math.format(result, {
				precision: Number(config.precision),
				notation: config.notation,
			});

			// Attach a name if necessary
			if (p.name && truthy(config.verbose))
				result = p.name + ': ' + result;
		} catch(e) {
			result = e.message;

			if (e.message.indexOf('Cannot create unit') === 0) {
				result = '';
			}
		}

		return {
			result: result,
			total: block_total,
			displaytotal: truthy(config.displaytotal) && !contains_total,
			inputHidden: config.hide === 'expression',
			resultHidden: config.hide === 'result',
			inline: truthy(config.inline),
			alignRight: config.align === 'right',
		};
	}

	function process_config(line: string, config: any) {
		const [ key, value ] = line.split(':', 2);
		config[key.trim()] = value.trim();

		if (truthy(config.bignumber)) {
			math.config({
					number: 'BigNumber',
					precision: 128
			});
		}
		else {
			math.config({
					number: 'number'
			});
		}

		return { isConfig: true };
	}

	function clear_math_widgets(cm: any, lineInfo: any) {
		// This could potentially cause a conflict with another plugin
		cm.removeLineClass(lineInfo.handle, 'wrap', 'cm-comment');

		if (lineInfo.widgets) {
			cm.removeLineClass(lineInfo.handle, 'text', 'math-hidden');
			cm.removeLineClass(lineInfo.handle, 'text', 'math-input-inline');

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

			if (lineData.resultHidden) continue;
			
			if (lineData.inputHidden)
				cm.addLineClass(i, 'text', 'math-hidden');
			else if (lineData.inline)
				cm.addLineClass(i, 'text', 'math-input-inline');


			const marker = lineData.inputHidden ? equation_result_collapsed : equation_result_separator;

			let result = lineData.result;

			if (lineData.displaytotal && !result.includes('total')) {
				result = lineData.total;
			}

			const res = document.createElement('div');
			const node = document.createTextNode(marker + result);
			res.appendChild(node);

			if (lineData.alignRight)
				res.setAttribute('class', 'math-result-right');

			// handleMouseEvents gives control of mouse handling for the widget to codemirror
			// This is necessary to get the cursor to be placed in the right location ofter
			// clicking on a widget
			// The downside is that it breaks copying of widget text (for textareas, it never
			// works on contenteditable)
			// I'm okay with this because I want the user to be able to select a block
			// without accidently grabbing the result
			cm.addLineWidget(i, res, { className: 'math-result-line', handleMouseEvents: true });
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

	function update_rates(cm: any) {
		get_exchange_rates().then(rates => {;
			math.createUnit(rates.base);
			Object.keys(rates.rates)
				.forEach((currency) => {
					math.createUnit(currency, math.unit(1/rates.rates[currency], rates.base));
				});
			reprocess(cm);
		});
	}

	// On each change we're going to scan for 
	function on_change(cm: any, change: any) {
		let lines = trim_lines(cm.getValue('\n').split('\n'));
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

	// I ran into an odd bug dueing development where the function where wouldn't be called
	// when the default value of the option was true (only happened on some notes)
	// The fix for me was to set the option to true in codeMirrorOptions instead
	CodeMirror.defineOption('enable-math-mode', false, function(cm, val, old) {
		// Cleanup
		if (old && old != CodeMirror.Init) {
			clearInterval(cm.state.mathMode.rateInterval);
			cm.state.mathMode = null;
			cm.off("change", on_change);
		}
		// setup
		if (val) {
			const interval = setInterval(() => { update_rates(cm); }, 1000*60*60*24);

			cm.state.mathMode = {
				scope: {},
				rateInterval: interval,
				globalConfig: Object.assign({}, defaultConfig),
				lineData: {},
			};

			update_rates(cm);
			reprocess(cm);
			// We need to process all blocks on the next update
			cm.on('change', on_change);
		}
	});
}

module.exports = {
	default: function(_context) { 
		return {
			plugin: plugin,
			codeMirrorResources: ['addon/mode/multiplex'],
			codeMirrorOptions: { mode: 'joplin-literate-math', 'enable-math-mode': true },
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
							`
					}
				];
			},
		}
	},
}
