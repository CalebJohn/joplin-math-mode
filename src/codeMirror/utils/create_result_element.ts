import { GlobalConfig } from '../../shared/types';
import { equation_result_collapsed, equation_result_separator } from "../../shared/constants";
import { ExpressionLineData, format_result } from "../../shared/utils/mathUtils";


// Font Awesome clipboard regular
const clipboard = `<svg aria-hidden="true" focusable="false" data-prefix="far" data-icon="clipboard" class="svg-inline--fa fa-clipboard fa-w-12" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path fill="currentColor" d="M336 64h-80c0-35.3-28.7-64-64-64s-64 28.7-64 64H48C21.5 64 0 85.5 0 112v352c0 26.5 21.5 48 48 48h288c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48zM192 40c13.3 0 24 10.7 24 24s-10.7 24-24 24-24-10.7-24-24 10.7-24 24-24zm144 418c0 3.3-2.7 6-6 6H54c-3.3 0-6-2.7-6-6V118c0-3.3 2.7-6 6-6h42v36c0 6.6 5.4 12 12 12h168c6.6 0 12-5.4 12-12v-36h42c3.3 0 6 2.7 6 6z"></path></svg>`;
// Font Awesome check
const check = `<svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="check" class="svg-inline--fa fa-check fa-w-16" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M173.898 439.404l-166.4-166.4c-9.997-9.997-9.997-26.206 0-36.204l36.203-36.204c9.997-9.998 26.207-9.998 36.204 0L192 312.69 432.095 72.596c9.997-9.997 26.207-9.997 36.204 0l36.203 36.204c9.997 9.997 9.997 26.206 0 36.204l-294.4 294.401c-9.998 9.997-26.207 9.997-36.204-.001z"></path></svg>`;

const format_thousands_separator = (
  input: string,
  separator: string = ','
): string  => {
  const formatNumber = (num: number): string => {
    const numStr = num.toString();
    const parts = numStr.split('.');
    const integerPart = parts[0];
    const decimalPart = parts[1] ? '.' + parts[1] : '';

    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, separator);

    return formattedInteger + decimalPart;
  };

	// Regex to match numbers (including decimals and negative numbers)
	// This matches: optional minus, digits, optional decimal point and more digits
	return input.replace(/-?\d+(?:\.\d+)?/g, (match) => {
		const num = parseFloat(match);
		// Only format if it's a valid number and has at least 4 digits in integer part
		if (!isNaN(num) && Math.abs(Math.floor(num)).toString().length >= 4) {
			return formatNumber(num);
		}
		return match;
	});
}

export const create_result_element = (lineData: ExpressionLineData, config: GlobalConfig) => {
	const marker = lineData.inputHidden ? equation_result_collapsed : equation_result_separator;

	let result = lineData.result;
	// Disable for now, this looks bad with complex results, will needto disable it there
	// Also need to accept a config variable
	// result = format_thousands_separator(result, " ");

	if (lineData.displaytotal && !result.includes('total')) {
		result = format_result(lineData.total, config);
	}

	const res = document.createElement('div');
	res.classList.add('math-result');
	if (!lineData.inline) {
		// The cm-line class is needed in CodeMirror 6 when the "editor maximum width" Joplin setting is set.
		// Without it, the math result elements do not respect the maximum width setting:
		res.classList.add('cm-line');
	}

	const txt = document.createElement('span');
	txt.setAttribute('class', 'math-copy-tooltip');
	txt.innerHTML = clipboard;

	const btn = document.createElement('span');
	btn.setAttribute('class', 'math-copy-button');
	btn.innerHTML = marker + result;
	btn.onclick = () => {
		navigator.clipboard.writeText(result)
			.then(() => txt.innerHTML = check)
			.catch(err => console.error("Could not copy text"));
	};
	btn.onmouseleave = () => {txt.innerHTML = clipboard;};

	// The order of children is important
	res.appendChild(btn);
	if (lineData.copyButton)
		res.appendChild(txt);

	if (lineData.alignRight)
		res.classList.add('math-result-right');

	if (lineData.inline) {
		res.classList.add('math-inline');
	}

	return res;
}