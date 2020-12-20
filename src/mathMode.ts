var math = require('mathjs');

interface PluginState {
	scope: object;
};

interface Block {
	start: number;
	end: number;
}

function plugin(CodeMirror) {
	CodeMirror.defineMode('joplin-literate-math', (config) => {
		return CodeMirror.multiplexingMode(
			// joplin-markdown is the CodeMirror mode that joplin uses
			CodeMirror.getMode(config, { name: 'joplin-markdown' }),
			{open: "```math", close: "```",
				mode: CodeMirror.getMode(config, { name: 'joplin-inner-math' }),
				delimStyle: 'comment', innerStyle: 'math-line'}
  );
	});

	// if is in a block return {start, end}
	// where start is the first math line of a block
	// and end is the close tag of the block (last line + 1)
	// otherwise returns false
	function find_block(cm: any, lineno: number): Block {
		if (!lineno && lineno !== 0) lineno = cm.lastLine();

		var start = -1;
		// A line is in a block if it is wrapped in a ```math and ```
		// We start at lineno - 1 to ensure that event the trailing
		// ``` will be treated as part of a block
		for (var i = lineno; i >= cm.firstLine(); i--) {
			var line = cm.getLineHandle(i);

			// if the lineno points to ``` it can still be in a block
			// but only if any line above is ``` will we quit
			if (line.text === '```' && i !== lineno) {
				return null;
			}
			else if (line.text === '```math') {
				start = i + 1;
				break;
			}
		}

		if (start === -1) return null;

		for (var i = lineno; i < cm.lineCount(); i++) {
			var line = cm.getLineHandle(i);

			if (line.text === '```') {
				return { start: start, end: i };
			}

		}

		return null;
	}

	// We sometimes we will want to find all the math blocks in order
	// to re-process an entire note
	function process_all(cm: any) {
		clear_widgets(cm, { start: cm.firstLine(), end: cm.lineCount() });

		for (var i = cm.firstLine(); i < cm.lineCount(); i++) {
			var block = find_block(cm, i);

			if (!block) continue;

			process_block(cm, block)

			// Jump to end of the block
			i = block.end + 1;
		}
	}

	function process_block(cm: any, block: Block) {
		clear_widgets(cm, block);

		// scope is global to the note
		var scope = cm.state.mathMode.scope;

		var line;
		for (var i = block.start; i < block.end; i++) {
			line = cm.getLineHandle(i);

			if (!line.text) continue;

			// Process one line
			var result = '';
			try {
				var p = math.parse(line.text);
				result = p.evaluate(scope);
				if (p.name)
					result = p.name + ': ' + result;
			} catch(e) {
				result = e.message;

				if (e.message.indexOf('Cannot create unit') === 0) {
					result = '';
				}
			}
			result = '=> ' + result;
			
			// Eventually we might want to support non-inline results
			cm.addLineClass(line, 'text', 'math-input-line');

			var node = document.createTextNode(result);
			cm.addLineWidget(line, node, { className: 'math-result-line', handleMouseEvents: true });
		}
	}

	function clear_math_widgets(cm: any, line: any) {
		if (line.widgets) {
			cm.removeLineClass(line.handle, 'text');

			for (var wid of line.widgets) {
				if (wid.className === 'math-result-line')
					wid.clear();
			}
		}
	}

	function clear_widgets(cm: any, block: Block) {
		for (var i = block.start; i < block.end; i++) {
			var line = cm.lineInfo(i);

			clear_math_widgets(cm, line);
		}
	}

	// If there are lines that don't belong to a block and contain math-result-line
	// widgets, then we should clear them
	function clean_up(cm: any) {
		for (var i = cm.firstLine(); i < cm.lineCount(); i++) {
			if (!find_block(cm, i)) {
				var line = cm.lineInfo(i);

				clear_math_widgets(cm, line);
			}
		}
	}

	function is_note_switch(cm: any, change: any) {
		return (change.from.line === cm.firstLine() &&
			change.to.line === change.removed.length - 1 &&
			change.origin === 'setValue'
		);
	}

	// On each change we're going to scan for 
	function on_change(cm: any, change: any) {
		clean_up(cm);

		if (is_note_switch(cm, change)) {
			cm.state.mathMode = { scope: {} };
		}

		// Most changes are the user typing a single character
		// If this doesn't happen inside a math block, we shouldn't re-process
		if (change.from.line === change.to.line) {
			var block = find_block(cm, change.from.line);

			// If this minor change didn't affect a math block then we quit early
			if (!block) return;
		}

		// Because the entire document shares one scope, 
		// we will re-process the entire document for each change
		process_all(cm);

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
			cm.state.mathMode = { scope: {} };
			process_all(cm);
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
											display: inline-block;
											padding-left: 15px;
										}
										.math-input-line {
											float: left;
										}
							`
					}
				];
			},
		}
	},
}
