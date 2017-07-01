'use babel';
const _ = require('underscore');
const EventEmitter = require('events');

export default class ChatUser extends EventEmitter {
	constructor(isMe, id, name, active) {
		super();
		atom.workspace.observeTextEditors((editor) => {
			this.instrumentEditor(editor);
        });
	}
	instrumentEditor(editor) {
		this.shareFile(editor);
		editor.onDidDestroy(() => {
			console.log('destroy');
		});
		editor.onDidChangePath((event) => {
			console.log(event);
		});
		editor.onDidStopChanging((event) => {
			console.log(event);
		});

		// editor.observeCursors((cursor) => {
		// 	this.instrumentCursor(cursor, editor);
		// });
	}
	instrumentCursor(cursor, editor) {
		cursor.onDidDestroy(() => {
			console.log('destroy cursor');
		});
		cursor.onDidChangePosition((event) => {
			console.log(event);
		});
	}
	shareFile(editor) {
		const contents = editor.getText();
		if(contents.length < 950) {
			console.log('share whole file', contents);
		} else {
			console.log('share chunks', chunkString(contents, 950));
		}
	}
}

function chunkString (str, len) {
	var _size = Math.ceil(str.length / len)
	var _ret = new Array(_size)
	var _offset = undefined
	var _i = 0

	while(_i < _size) {
		_offset = _i * len
		_ret[_i] = str.substring(_offset, _offset + len)
		_i++
	}
	return _ret;
}
