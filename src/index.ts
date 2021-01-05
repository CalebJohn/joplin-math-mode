import joplin from 'api';
import { ContentScriptType } from 'api/types';
import { MenuItemLocation } from 'api/types';

joplin.plugins.register({
	onStart: async function() {
		await joplin.plugins.registerContentScript(
			ContentScriptType.CodeMirrorPlugin,
			'literate-math-mode',
			'./mathMode.js'
		);
		await joplin.commands.register({
			name: 'editor.mathMode.insertMathResult',
			label: 'Insert Math Result',
			execute: async () => {
				alert('mathMode.insertMathResult not implemented by Editor yet');
			},
		});
		await joplin.views.menuItems.create('mathModeInsertButton', 'editor.mathMode.insertMathResult', MenuItemLocation.EditorContextMenu);
	},
});
