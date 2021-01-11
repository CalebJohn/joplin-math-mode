const mathjs = require('mathjs');

interface PluginState {
	scope: object;
};

interface Block {
	start: number;
	end: number;
}

const inline_math_regex = /^=/;
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

	CodeMirror.commands['mathMode.insertMathResult'] = function(cm: any) {
		const { line } = cm.getCursor();
		insert_math_at(cm, line);
	};


	// Eventually we want to set this based on the Joplin settings
	const defaultConfig = {
		global: 'no',
		simplify: 'no',
		hide: 'no',
		verbose: 'yes',
		inline: 'yes',
		notation: 'auto',
		precision: '4',
		align: 'left',
	};

	function truthy(s: string) {
		s = s.toLowerCase();
		return s.startsWith('t') || s.startsWith('y') || s === '1';
	}

	function falsey(s: string) {
		s = s.toLowerCase();
		return s.startsWith('f') || s.startsWith('n') || s === '0';
	}

	// if is in a block return {start, end}
	// where start is the first math line of a block
	// and end is the close tag of the block (last line + 1)
	// otherwise returns false
	function find_block(cm: any, lineno: number): Block {
		if (!lineno && lineno !== 0) lineno = cm.lastLine();

		let start = -1;
		// A line is in a block if it is wrapped in a ```math and ```
		// We start at lineno - 1 to ensure that event the trailing
		// ``` will be treated as part of a block
		for (let i = lineno; i >= cm.firstLine(); i--) {
			const line = cm.getLine(i);

			// If we encounter an end of block marker
			// then we know we wer not in a block
			if (line === '```') {
				return null;
			}
			else if (line === '```math') {
				start = i + 1;
				break;
			}
		}

		if (start === -1) return null;

		for (let i = start; i < cm.lineCount(); i++) {
			const line = cm.getLine(i);

			if (line.indexOf('```') === 0) {
				if (line.trim() === '```') {
					return { start: start, end: i - 1 };
				}

				return null;
			}
		}

		return null;
	}

	function find_inline_math(cm: any, lineno: number): Block {
		const line = cm.getLine(lineno);

		if (line.match(inline_math_regex)) {
			return { start: lineno, end: lineno };
		}

		return null;
	}

	function find_math(cm: any, lineno: number): Block {
		const block = find_block(cm, lineno);
		const inline = find_inline_math(cm, lineno);

		// It's possible that a user may input an inline math style line into a block
		// and we don't want that to prevent this system from finding the block
		// so we check for the block first and check for inline if no block is found
		return block ? block : inline;
	}

	// We sometimes we will want to find all the math blocks in order
	// to re-process an entire note
	function reprocess_all(cm: any) {
		cm.state.mathMode.scope = {};
		cm.state.mathMode.lineData = {};

		let noteConfig = Object.assign({}, defaultConfig);

		for (let i = cm.firstLine(); i < cm.lineCount(); i++) {
			const to_process = find_math(cm, i);

			if (!to_process) continue;

			process_block(cm, to_process, noteConfig)

			// Jump to end of the block
			// This does nothing for inline math, and prevents duplicated
			// running of larger blocks
			i = to_process.end;
		}

		refresh_widgets(cm, { start: cm.firstLine(), end: cm.lineCount() - 1 });
	}

	function insert_math_at(cm: any, lineno: number) {
		const line = cm.getLine(lineno);
		const result = cm.state.mathMode.lineData[lineno];

		cm.replaceRange(line + equation_result_separator + result, { line: lineno, ch: 0 }, { line: lineno, ch:line.length });
	}

	function get_line_equation(line: string): string {
		return line.replace(inline_math_regex, '');
	}

	function process_block(cm: any, block: Block, noteConfig: any) {
		// scope is global to the note
		let scope = cm.state.mathMode.scope;
		let config = Object.assign({}, noteConfig);
		const math = mathjs.create(mathjs.all, { number: 'BigNumber' });

		for (let i = block.start; i <= block.end; i++) {
			const full_line = cm.getLine(i).split(equation_result_separator);
			const line = full_line[0];

			if (!line) continue;

			// This is configuration, not math
			// current system is fairly simplistic (maybe even ugly)
			// but it's small enough now that I can justify it
			// remember to re-evaulate this if/when things get more complex
			if (line.includes(':')) {
				const [ key, value ] = line.split(':', 2);
				config[key.trim()] = value.trim();
				cm.state.mathMode.lineData[i] = { isConfig: true };

				if (falsey(config.simplify)) {
					math.config({
							number: 'BigNumber',
							precision: 64
					});
				}
				else {
					math.config({
							number: 'number'
					});
				}

				continue;
			}

			// Process one line
			let result = '';
			try {
				const p = math.parse(get_line_equation(line));

				if (falsey(config.simplify))
					result = p.evaluate(scope);
				else
					result = math.simplify(p)

				result = math.format(result, {
					precision: Number(config.precision),
					notation: config.notation,
				});

				if (p.name && truthy(config.verbose))
					result = p.name + ': ' + result;
			} catch(e) {
				result = e.message;

				if (e.message.indexOf('Cannot create unit') === 0) {
					result = '';
				}
			}

			cm.state.mathMode.lineData[i] = {
				result: result,
				inputHidden: config.hide === 'expression',
				resultHidden: config.hide === 'result',
				inline: truthy(config.inline),
				alignRight: config.align === 'right',
			}
		}

		if (truthy(config.global)) {
			noteConfig = Object.assign(noteConfig, config, {global: 'block'});
		}
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

	function refresh_widgets(cm: any, block: Block) {
		for (let i = block.start; i <= block.end; i++) {
			const line = cm.lineInfo(i);

			clear_math_widgets(cm, line);

			const full_line = line.text.split(equation_result_separator);
			const lineData = cm.state.mathMode.lineData[i];

			// Don't bother showing the result if it has already been inserted into the text
			if (full_line[1]) continue;

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

			const res = document.createElement('div');
			const node = document.createTextNode(marker + lineData.result);
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

	// If there are lines that don't belong to a block and contain math-result-line
	// widgets, then we should clear them
	function clean_up(cm: any) {
		for (let i = cm.firstLine(); i < cm.lineCount(); i++) {
			if (!find_math(cm, i)) {
				const line = cm.lineInfo(i);

				clear_math_widgets(cm, line);
			}
		}
	}

	// On each change we're going to scan for 
	function on_change(cm: any, change: any) {
		clean_up(cm);

		// Most changes are the user typing a single character
		// If this doesn't happen inside a math block, we shouldn't re-process
		// +input means the user input the text (as opposed to joplin/plugin)
		// +delete means the user deleted some text
		// setValue means something programically altered the text
		if (change.from.line === change.to.line && change.origin !== "setValue") {
			const block = find_math(cm, change.from.line);
			const prev = find_math(cm, Math.max(change.from.line - 1, cm.firstLine()));

			// If this minor change didn't affect a math section then we quit early
			if (!block && !prev) return;
		}

		
		if (cm.state.mathMode.timer)
			clearTimeout(cm.state.mathMode.timer);

		cm.state.mathMode.timer = setTimeout(() => {
		// Because the entire document shares one scope, 
		// we will re-process the entire document for each change
			reprocess_all(cm);
			cm.state.mathMode.timer = null;
		}, 300);

		// Eventually we might want an option for per-block processing/scope
		//
		// We might also want to use the change.from.line and change.to.line
		// to make this more efficient, but I'm avoiding the complexity for now
		// (I ran into an issue when doing a full note switch where the new note
		// had a math block lower in the new note than the entire length of the 
		// original note, so the original logic which only looked for blocks within
		// the from and to of the change didn't work)
	}

	// I ran into an odd bug dueing development where the function where wouldn't be called
	// when the default value of the option was true (only happened on some notes)
	// The fix for me was to set the option to true in codeMirrorOptions instead
	CodeMirror.defineOption('enable-math-mode', false, function(cm, val, old) {
		// Cleanup
    if (old && old != CodeMirror.Init) {
			cm.state.mathMode = null;
      cm.off("change", on_change);
    }
		// setup
		if (val) {
			cm.state.mathMode = {
				scope: {},
				lineData: {},
			};

			reprocess_all(cm);
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
