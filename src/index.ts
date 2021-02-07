import joplin from 'api';
import { ContentScriptType } from 'api/types';
import { MenuItemLocation } from 'api/types';

const contentScriptId = 'literate-math-mode';

joplin.plugins.register({
	onStart: async function() {
		await joplin.contentScripts.register(
			ContentScriptType.CodeMirrorPlugin,
			contentScriptId,
			'./mathMode.js'
		);

	},
});
