import joplin from 'api';
import { ContentScriptType } from 'api/types';
import { MenuItemLocation } from 'api/types';

joplin.plugins.register({
	onStart: async function() {
		await joplin.contentScripts.register(
			ContentScriptType.CodeMirrorPlugin,
			'literate-math-mode',
			'./mathMode.js'
		);

		// Uncomment when https://github.com/laurent22/joplin/pull/4303 is merged
		// await joplin.commands.register({
		// 	name: 'editor.mathMode.insertMathResult',
		// 	label: 'Insert Math Result',
		// 	execute: async () => {
		// 		alert('mathMode.insertMathResult not implemented by Editor yet');
		// 	},
		// });
		// await joplin.views.menuItems.create('mathModeInsertButton', 'editor.mathMode.insertMathResult', MenuItemLocation.EditorContextMenu);
	},
});
