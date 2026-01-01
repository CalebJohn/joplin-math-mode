import { ExpressionLineData, format_result, LineDataType } from '../shared/utils/mathUtils';
import { GlobalConfig } from '../shared/types';
import { equation_result_collapsed, equation_result_separator, inline_math_regex } from '../shared/constants';


export function renderExpressionLine(inputLine: string, lineData: ExpressionLineData, config: GlobalConfig, markdownIt: any, inBlock: boolean): string {
	if (lineData.resultHidden && lineData.inputHidden) {
		return '';
	}

	const marker = lineData.inputHidden ? equation_result_collapsed : equation_result_separator;
	let result = lineData.result;

	if (lineData.displaytotal && !result.includes('total')) {
		result = format_result(lineData.total, config);
	}

	// Escape HTML to prevent XSS
	const escapedResult = markdownIt.utils.escapeHtml(result);
	const escapedInput = markdownIt.utils.escapeHtml(inputLine.trim());

	const classes = ['math-result'];
	if (lineData.alignRight) {
		classes.push('math-result-right');
	}
	if (lineData.inline) {
		classes.push('math-inline');
	}

	let html = '';

	if (lineData.inline && !lineData.inputHidden) {
		// Remove the leading = from inline math expressions
		const strippedInput = markdownIt.utils.escapeHtml(inputLine.replace(inline_math_regex, ''));
		html += `<span class="math-input-inline">${strippedInput}</span>`;
	}

	if (!lineData.resultHidden) {
		html += `<div class="${classes.join(' ')}">${marker}${escapedResult}</div>`;
	}

	if (inBlock) {
		return `<div class="math-expression-line">${html}</div>`;
	} else {
		return `<div class="joplin-editable math-expression-line"><pre class="joplin-source" data-joplin-language="math" data-joplin-source-open="\`\`\`math\n" data-joplin-source-close="\n\`\`\`">${escapedInput}</pre>${html}</div>`;
	}
}

export function renderMathBlock(lines: string[], lineDataArray: any[], startLine: number, config: GlobalConfig, markdownIt: any): string {
	let html = '';

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const lineData = lineDataArray[startLine + i];

		if (lineData && lineData.type === LineDataType.Expression) {
			html += renderExpressionLine(line, lineData as ExpressionLineData, config, markdownIt, true);
		} else if (!lineData || lineData.type !== LineDataType.Config) {
			if (line.trim()) {
				const rendered = markdownIt.renderInline(line);
				html += `<div class="math-passthrough-line">${rendered}</div>`;
			}
		}
	}

	return html;
}
