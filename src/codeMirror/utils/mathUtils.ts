import { inline_math_regex } from "../constants";
import { GlobalConfig, MathBlockType } from "../types";

const mathjs = require('mathjs');
export const math = mathjs.create(mathjs.all, {});

interface Options {
	globalConfig: GlobalConfig;
}

export enum LineDataType {
	Config,
	Expression,
}

interface ConfigLineData {
	type: LineDataType.Config,
}

export interface ExpressionLineData {
	type: LineDataType.Expression,
	result: string,
	total: string,
	displaytotal: boolean,
	inputHidden: boolean,
	resultHidden: boolean,
	inline: boolean,
	alignRight: boolean,
	copyButton: boolean,
}

export type LineData = ConfigLineData|ExpressionLineData;

export interface ProcessContext {
	total: string;
	config: GlobalConfig & { global?: string };
	globalConfig: GlobalConfig;
	scope: Record<string, unknown>;
}

export const defaultProcessContext = (globalConfig: GlobalConfig): ProcessContext => ({
	total: '',
	config: {...globalConfig},
	globalConfig,
	scope: { },
});

export function process_next(line: string, context: ProcessContext): [LineData, ProcessContext] {
	let config = context.config;
	let globalConfig = context.globalConfig;
	let block_total = context.total;
	let scope = context.scope;

	let lineData: LineData|null;
	if (!line || line === '```math') {
		block_total = '';
	}
	else if (line === '```') {
		config = Object.assign({}, globalConfig);
		block_total = '';
	}
	else if (line.includes(':')) {
		lineData = process_config(line, config);
	}
	else if (line.trim().startsWith('#') || line.trim().startsWith('//')) {
		// Ignore comment lines
	}
	else {
		// Allow the user to redefine the total variable if they want
		const localScope = Object.assign({total: block_total}, scope);
		const data = process_expression_line(line, localScope, config, block_total);
		lineData = data;
		// Update the scope
		scope = {...scope, ...localScope};
		block_total = data.total;
	}

	if (truthy(config.global)) {
		globalConfig = { ...globalConfig, ...config, global: 'no' };
	}

	const newContext: ProcessContext = {
		total: block_total,
		globalConfig,
		config,
		scope,
	};
	return [ lineData, newContext ];
}

export function process_all(allLines: string[], options: Options) {
	const allow_inline = options.globalConfig.inlinesyntax;
	const lines = trim_lines(allLines, allow_inline);

	const lineData = [];

	// scope is global to the note
	let context = defaultProcessContext(options.globalConfig);
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const [ nextLineData, newContext ] = process_next(line, context);
		context = newContext;
		if (nextLineData) {
			lineData[i] = nextLineData;
		}
	}

	return lineData;
}

function shallow_equal(a: Record<string, any>, b: Record<string, any>) {
	if (Object.keys(a).length !== Object.keys(b).length) return false;

	for (const [key, value] of Object.entries(a)) {
		if (b[key as keyof typeof b] !== value) {
			return false;
		}
	}

	return true;
}

export function lineDataEqual(a: LineData, b: LineData) {
	return shallow_equal(a, b);
}

function truthy(s: string) {
	s = s.toLowerCase();
	return s.startsWith('t') || s.startsWith('y') || s === '1';
}

function falsey(s: string) {
	s = s.toLowerCase();
	return s.startsWith('f') || s.startsWith('n') || s === '0';
}

function process_config(line: string, config: any): ConfigLineData {
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

	return {
		type: LineDataType.Config,
	};
}

// Helper for the math lines function,
// removes all lines until the ```math symbol
function erase_to_start(lines: string[], lineno: number, allow_inline: boolean) {
	for (let i = lineno; i >= 0; i--) {
		const line = lines[i];
		if (!line) continue;

		if (line.trim() === '```math') {
			break;
		}
		else if (!(allow_inline && line.match(inline_math_regex))) {
			lines[i] = '';
		}
	}
}

// Takes in an array of all lines, and strips out any non-math lines
export function trim_lines(lines: string[], allow_inline: boolean) {
	let might_be_in_block = false;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (!line) continue;

		if (allow_inline && line.match(inline_math_regex)) {
			continue;
		}
		else if (might_be_in_block && line.trim() === '```') {
			might_be_in_block = false;
			lines[i] = '```';
			continue;
		}
		else if (line.trim() === '```math') {
			might_be_in_block = true;
			lines[i] = '```math';
		}

		if (!might_be_in_block)
			lines[i] = '';
	}
	if (might_be_in_block) {
		erase_to_start(lines, lines.length, allow_inline);
	}

	return lines;
}

function get_line_equation(line: string): string {
	return line.replace(inline_math_regex, '');
}

function get_sum_type(line: string): MathBlockType {
	const match = inline_math_regex.exec(line)

	if (match && match.length > 1 && match[1] === '-')
		return '-';

	return '+';
}

function math_contains_assignment(parsed: any, name: string) {
	if (!parsed) return false;

	const filtered = parsed.filter(function (n: any) {
		return n.isAssignmentNode && n.name === name
	});

	return filtered.length > 0;
}

function math_contains_symbol(parsed: any, name: string) {
	if (!parsed) return false;

	const filtered = parsed.filter(function (n: any) {
		return n.isSymbolNode && n.name === name
	});

	return filtered.length > 0;
}

export function format_result(result: any, config: GlobalConfig): any {
	return math.format(result, {
		precision: Number(config.precision),
		lowerExp: Number(config.lowerExp),
		upperExp: Number(config.precision),
		notation: config.notation,
	});
}

function process_expression_line(line: string, scope: any, config: any, block_total: string): ExpressionLineData {
	let p = null;
	let result = '';
	let contains_total = false;

	try {
		p = math.parse(get_line_equation(line));

		// Evaluate the Expression
		if (falsey(config.simplify))
			result = p.evaluate(scope);
		else
			result = math.simplify(p)

		contains_total = math_contains_symbol(p, 'total');
		if (result && !contains_total) {
			const sum_char = get_sum_type(line);
			// An error can occur when the types don't match up
			// To recover, restart the sum counter
			try {
				block_total = math.parse(`${block_total} ${sum_char} ${result}`).evaluate(scope);
			}
			catch(err) {
				// If the error parsing still fails, we will just return the result (no sign)
				// This will fail in cases were the result type is a symbolic type
				// There is probably a better method to handle this case
				try {
					block_total = math.parse(`${sum_char} ${result}`).evaluate(scope);
				}
				catch(errr) {
					block_total = result;
				}
			}
		}
		// Format the output
		result = format_result(result, config);

		// Attach a name if necessary
		if (p.name && truthy(config.verbose))
			result = p.name + ': ' + result;
	} catch(e) {
		result = e.message;

		if (e.message.indexOf('Cannot create unit') === 0) {
			result = '';
		}
	}

	// If the total variable wasn't modified, clear it
	// This needs to be outside the "try" statement to guarantee that it runs
	if (!math_contains_assignment(p, 'total'))
		delete scope['total'];


	return {
		type: LineDataType.Expression,
		result: result,
		total: block_total,
		displaytotal: truthy(config.displaytotal) && !contains_total,
		inputHidden: config.hide === 'expression',
		resultHidden: config.hide === 'result' || result === '',
		inline: truthy(config.inline),
		alignRight: config.align === 'right',
		copyButton: config.copyButton,
	};
}
