'use babel';
const _ = require('underscore');
const EventEmitter = require('events');

const {Range} = require('atom');

export default class WatchEditor extends EventEmitter {
	constructor(isMe, id, name, active) {
		super();
		this.buffers = new Set();
		this.deltas = {};
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
		return true;
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
		if(!this.shouldSendEditor(editor)) { return; }
		const buffer = editor.getBuffer();

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
		var changeObserver = buffer.onDidChangeText((event) => {
			if(event.changes.length > 0) {
				this.emit('editor-changed', {
					id: editor.id,
					shouldEmit: !this.isIgnoringChanges(),
					changes: _.map(event.changes, (c) => {
						return this.getDelta(c);
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
	getDelta(change) {
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
	updatePositionsFromAnchor(delta) {
		const oldRange = delta.oldRangeAnchor.getBufferRange();
		const newRange = delta.newRangeAnchor.getBufferRange();
		delta.oldRange = oldRange.serialize();
		delta.newRange = newRange.serialize();

		delta.oldRange.start = [oldRange.start.row, oldRange.start.column];
		delta.oldRange.end = [oldRange.end.row, oldRange.end.column];
		delta.newRange.start = [newRange.start.row, newRange.start.column];
		delta.newRange.end = [newRange.end.row, newRange.end.column];
		return delta;
	}
	getAnchoredDelta(delta, editor) {
		return  _.extend({
			oldRangeAnchor: editor.markBufferRange(new Range(delta.oldRange.start, delta.oldRange.end)),
			newRangeAnchor: editor.markBufferRange(new Range(delta.newRange.start, delta.newRange.end)),
		}, delta);
	}
	getEditorDeltaHistory(editor) {
		if(_.has(this.deltas, editor.id)) {
			return this.deltas[editor.id];
		} else {
			const deltas = []
			this.deltas[editor.id] = deltas;
			return deltas;
		}
	}
	handleChanges(event, mustPerformChange) {
		if(mustPerformChange === undefined) {
			mustPerformChange = true;
		}
        var editor;
        atom.textEditors.editors.forEach((e) => {
            if(e.id === event.id) {
                editor = e;
            }
        });
		const deltas = this.getEditorDeltaHistory(editor);

		var i = deltas.length-1;
		var d;
		for(; i>=0; i--) {
			d = deltas[i];
			if(d.timestamp > event.timestamp) {
				this.undoDelta(d, editor);
			} else {
				break;
			}
		}
		const insertAt = i+1;

		const anchoredDeltas = _.map(event.changes, (delta) => { return this.getAnchoredDelta(delta, editor) });

		deltas.splice.apply(deltas, [insertAt,0].concat(anchoredDeltas));

		if(mustPerformChange) {
			i = insertAt;
		} else {
			i = insertAt + event.changes.length;
		}

		for(; i<deltas.length; i++) {
			d = deltas[i];
			this.updatePositionsFromAnchor(d);
			this.doDelta(d, editor);
		}
	}
	doDelta(delta, editor) {
        const {oldText, newText, timestamp} = delta;
        const oldRange = new Range(delta.oldRange.start, delta.oldRange.end);
        const newRange = new Range(delta.newRange.start, delta.newRange.end);

		this.beginIgnoringChanges();
        editor.setTextInBufferRange(oldRange, newText);
		this.endIgnoringChanges();
	}
	undoDelta(delta, editor) {
        const {oldText, newText, timestamp} = delta;
        const oldRange = new Range(delta.oldRange.start, delta.oldRange.end);
        const newRange = new Range(delta.newRange.start, delta.newRange.end);

		this.beginIgnoringChanges();
        editor.setTextInBufferRange(newRange, oldText);
		this.endIgnoringChanges();
		// const Range = ace.acequire('ace/range').Range
		// const oldRange = new Range(delta.oldRange.start[0], delta.oldRange.start[1], delta.oldRange.end[0], delta.oldRange.end[1]);
		// const newRange = new Range(delta.newRange.start[0], delta.newRange.start[1], delta.newRange.end[0], delta.newRange.end[1]);
		// const {oldText, newText} = delta;
        // const editor = this.editor.getEditor();
		// const session = editor.getSession();
		//
		// session.replace(newRange, oldText);
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
