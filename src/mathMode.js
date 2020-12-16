var math = require('mathjs');

function plugin(CodeMirror) {
	CodeMirror.defineMode('joplin-literate-math', (config) => {
		return CodeMirror.multiplexingMode(
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
	function find_block(cm, lineno) {
		if (!lineno) lineno = cm.lastLine();

		var start = -1;
		// A line is in a block if it is wrapped in a ```math and ```
		for (var i = lineno; i >= cm.firstLine(); i--) {
			var line = cm.getLineHandle(i);

			if (line.text === '```') {
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
	function process_all(cm) {
		clear_widgets(cm, { start: cm.firstLine(), end: cm.lineCount() });

		for (var i = cm.firstLine(); i < cm.lineCount(); i++) {
			var block = find_block(cm, i);

			if (!block) continue;

			process_block(cm, block)

			// Jump to end of the block
			i = block.end;
		}
	}

	function process_block(cm, block) {
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
			cm.addLineClass(line, 'text', 'math-cm-line');

			var node = document.createTextNode(result);
			cm.addLineWidget(line, node, { className: 'math-result', handleMouseEvents: true });
		}
	}

	function clear_widgets(cm, block) {
		for (var i = block.start; i < block.end; i++) {
			var line = cm.lineInfo(i);
			if (line.widgets) {
				cm.removeLineClass(line.handle, 'text');
				for (var wid of line.widgets) {
					if (wid.className === 'math-result')
						wid.clear();
				}
			}
		}
	}

	// On each change we're going to scan for 
	function on_change(cm, change) {
		var block = find_block(cm, change.from.line);

		if (block) {
			// Because the entire document shares one scope, 
			// we will re-process the entire document for each change
			process_all(cm);


			// // Eventually we might want an option for per-block processing/scope
			// process_block(cm, block);
		}
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
						text: `.math-result {
											opacity: 0.75;
											display: inline-block;
											padding-bottom: 5px;
											padding-left: 15px;
										}
										.math-cm-line {
											float: left;
										}
							`
					}
				];
			},
		}
	},
}
