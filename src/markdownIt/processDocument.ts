import { process_all } from '../shared/utils/mathUtils';
import { GlobalConfig } from '../shared/types';
import { LineData } from '../shared/utils/mathUtils';

export interface ProcessedDocumentData {
	lineData: LineData[];
	lines: string[];
}

// The process_all function was originally written just for the editor to use, this is a wrapper
// around it to do some handling specific to the viewer
export function processDocumentMath(src: string, globalConfig: GlobalConfig): ProcessedDocumentData {
	const lines = src.split('\n');
	const lineData = process_all(lines, { globalConfig });

	return {
		lineData,
		lines,
	};
}

