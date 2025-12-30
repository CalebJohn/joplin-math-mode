import { ExpressionLineData, format_result, LineDataType } from '../shared/utils/mathUtils';
import { GlobalConfig } from '../shared/types';
import { equation_result_collapsed, equation_result_separator } from '../shared/constants';


export function renderExpressionLine(inputLine: string, lineData: ExpressionLineData, config: GlobalConfig, escapeHtml: (s: string) => string, inBlock: boolean): string {
	if (lineData.resultHidden && lineData.inputHidden) {
		return '';
	}

	const marker = lineData.inputHidden ? equation_result_collapsed : equation_result_separator;
	let result = lineData.result;

	if (lineData.displaytotal && !result.includes('total')) {
		result = format_result(lineData.total, config);
	}

	// Escape HTML to prevent XSS
	const escapedResult = escapeHtml(result);
	const escapedInput = escapeHtml(inputLine);

	const classes = ['math-result'];
	if (lineData.alignRight) {
		classes.push('math-result-right');
	}
	if (lineData.inline) {
		classes.push('math-inline');
	}

	let html = '';

	if (lineData.inline && !lineData.inputHidden) {
		html += `<span class="math-input-inline">${escapedInput}</span>`;
	}

	if (!lineData.resultHidden) {
		html += `<div class="${classes.join(' ')}">${marker}${escapedResult}</div>`;
	}

	return `<div class="math-expression-line">${html}</div>`;
	// if (inBlock) {
	// 	return html;
	// } else {
		// return `<div class="joplin-editable"><pre class="joplin-source" data-joplin-language="math" data-joplin-source-open="\`\`\`math\n" data-joplin-source-close="\`\`\`">${escapedInput}</pre>${html}</div>`;
	// }
}

export function renderMathBlock(lines: string[], lineDataArray: any[], startLine: number, config: GlobalConfig, escapeHtml: (s: string) => string): string {
	let html = '';

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const lineData = lineDataArray[startLine + i];

		if (lineData && lineData.type === LineDataType.Expression) {
			html += renderExpressionLine(line, lineData as ExpressionLineData, config, escapeHtml, true);
		}
	}

	return html;
}
