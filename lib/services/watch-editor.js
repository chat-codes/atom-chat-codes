'use babel';
const _ = require('underscore');
const EventEmitter = require('events');

export default class WatchEditor extends EventEmitter {
	constructor(isMe, id, name, active) {
		super();
		this.observers = [];
		this.ignoreChanges = false;
	}
	ready() {
		var teObserver = atom.workspace.observeTextEditors((editor) => {
			this.instrumentEditor(editor);
        });
		this.observers.push(teObserver);
	}
	beginIgnoringChanges() {
		this.ignoreChanges = true;
	}
	endIgnoringChanges() {
		this.ignoreChanges = false;
	}
	isIgnoringChanges() {
		return this.ignoreChanges;
	}
	shouldSendEditor (editor) {
		// return true;
		return editor.getTitle() === 'editor.component.ts';
	}
	getEditorState() {
		return _.compact(_.map(atom.workspace.getTextEditors(), (editor) => {
			if(this.shouldSendEditor(editor)) {
				return this.serializeEditorState(editor);
			} else {
				return false;
			}
		}));
	}
	instrumentEditor(editor) {
		if(!this.shouldSendEditor(editor)) {
			return
		}

		this.shareFile(editor);
		var cursorObservers = editor.observeCursors((cursor) => {
			this.instrumentCursor(cursor, editor);
		});
		var destroyObserver = editor.onDidDestroy(() => {
			this.emit('editor-destroyed', {
				id: editor.id
			});
		});
		var titleObserver = editor.onDidChangeTitle((newTitle) => {
			this.emit('editor-title-changed', {
				id: editor.id,
				newTitle: newTitle
			});
		});
		const buffer = editor.getBuffer();
		var changeObserver = buffer.onDidChangeText((event) => {
			if(event.changes.length > 0) {
				this.emit('editor-changed', {
					id: editor.id,
					shouldEmit: !this.isIgnoringChanges(),
					changes: _.map(event.changes, (c) => {
						return this.serializeChange(c);
					})
				});
			}
		});
		var grammarChangeObserver = editor.onDidChangeGrammar((grammar) => {
			this.emit('editor-grammar-changed', {
				id: editor.id,
				grammarName: grammar.name
			});
		});
		// editor.onDidConflict(() => { });
		this.observers.push(cursorObservers, destroyObserver, titleObserver, changeObserver, grammarChangeObserver);
	}
	instrumentCursor(cursor, editor) {
		var destroyObserver = cursor.onDidDestroy(() => {
			this.emit('cursor-destroyed', {
				id: cursor.id
			});
		});
		var changePositionObserver = cursor.onDidChangePosition(_.throttle((event) => {
			this.emit('cursor-changed-position', {
				id: cursor.id,
				oldBufferPosition: event.oldBufferPosition.serialize(),
				newBufferPosition: event.newBufferPosition.serialize(),
			})
		}, 300));
		this.observers.push(destroyObserver, changePositionObserver);
	}
	shareFile(editor) {
		this.emit('editor-shared', this.serializeEditorState(editor));
	}
	serializeEditorState(editor) {
		const grammar = editor.getGrammar();

		return {
			id: editor.id,
			contents: editor.getText(),
			grammarName: grammar.name,
			title: editor.getTitle(),
			cursors: _.map(editor.getCursors(), (c) => {
				return this.serializeCursor(c);
			})
		};
	}
	serializeCursor(cursor) {
		const marker = cursor.getMarker();

		return {
			id: cursor.id,
			range: this.serializeRange(marker.getBufferRange())
		};
	}
	serializeRange(range) {
		return {
			start: range.start.serialize(),
			end: range.end.serialize()
		};
	}
	serializeChange(change) {
		return {
			newRange: this.serializeRange(change.newRange),
			oldRange: this.serializeRange(change.oldRange),
			newText: change.newText,
			oldText: change.newText,
		};
	}
	destroy() {
		_.each(this.observers, (o) => {
			o.dispose();
		})
		this.observers = [];
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
