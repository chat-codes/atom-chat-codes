'use babel';

const _ = require('underscore');
const $ = require('jquery');
const EventEmitter = require('events');

const {Point,Range} = require('atom');


export class WatchEditor extends EventEmitter {
	constructor() {
		super();
		this.observers = [];
		this.ignoreChanges = false;
		this.changeQueues = {};
		this.editorStates = {};
		this.sendChanges = _.debounce(() => {
			_.each(this.changeQueues, (changeQueue, editorID) => {
				editorID = parseInt(editorID);
				if(changeQueue.length > 0) {
					const changes = _	.chain(changeQueue)
										.pluck('changes')
										.flatten(true)
										.map((c) => {
											return {
												newRange: this.serializeRange(c.newRange),
												oldRange: this.serializeRange(c.oldRange),
												newText: c.newText,
												oldText: c.newText
											};
										})
										.value();
					const lastChange = _.last(changeQueue);
					const delta = {
						type: 'edit',
						id: editorID,
						timestamp: lastChange.timestamp,
						changes: changes
					};
					this.emit('editor-event', this.serializeDelta(delta));
				}
			});
			this.changeQueues = {};
		}, 50);
	}
	ready() {
		var teObserver = atom.workspace.observeTextEditors((editor) => {
			this.instrumentEditor(editor);
        });
		this.observers.push(teObserver);
	}
	getChangeQueueForEditor(editorID) {
		if(_.has(this.changeQueues, editorID)) {
			return this.changeQueues[editorID];
		} else {
			return this.changeQueues[editorID] = [];
		}
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
		// return editor.getTitle() === 'README.md';
		return true;
	}


	getCurrentTitleFromDeltas(editor) {
		const deltas = this.getDeltaHistory(editor, ['open', 'title']);
		const lastDelta = _.last(deltas);
		return lastDelta.type === 'open' ? lastDelta.title : lastDelta.newTitle;
	}

	getCurrentGrammarFromDeltas(editor) {
		const deltas = this.getDeltaHistory(editor, ['open', 'grammar']);
		const lastDelta = _.last(deltas);
		return lastDelta.type === 'open' ? lastDelta.grammarName : lastDelta.newGrammarName;
	}

	serializeDelta(delta) {
		if(delta.type === 'edit') {
			return _.extend({}, delta, {
				changes: _.map(delta.changes, (c) => {
					return _.omit(c, 'oldRangeAnchor', 'newRangeAnchor');
				})
			});
		} else {
			return delta;
		}
	}

	instrumentEditor(editor) {
		if(!this.shouldSendEditor(editor)) { return; }

		const editorState = this.getEditorState(editor);
		const deltas = editorState.deltas;
		const buffer = editor.getBuffer();

		const openDelta =  {
			type: 'open',
			id: editor.id,
			contents: editor.getText(),
			grammarName: editor.getGrammar().name,
			title: editor.getTitle(),
		};
		deltas.push(openDelta);
		this.emit('open-editor', this.serializeEditorState(editorState));

		var cursorObservers = editor.observeCursors((cursor) => {
			this.instrumentCursor(cursor, editor);
		});
		var selectionObservers = editor.onDidChangeSelectionRange((event) => {
			const {oldBufferRange,newBufferRange,selection} = event;
			this.emit('cursor-event', {
				id: selection.cursor.id,
				editorID: editor.id,
				newRange: this.serializeRange(newBufferRange),
				oldRange: this.serializeRange(oldBufferRange),
				type: 'change-selection'
			});
		});
		var destroyObserver = editor.onDidDestroy(() => {
			const delta = {
				type: 'destroy',
				id: editor.id
			};
			deltas.push(delta);
			this.emit('editor-event', this.serializeDelta(delta));
		});
		var titleObserver = editor.onDidChangeTitle(() => {
			const delta = {
				type: 'title',
				newTitle: editor.getTitle(),
				oldTitle: this.getCurrentTitleFromDeltas(editor),
				id: editor.id
			};
			deltas.push(delta);
			this.emit('editor-event', this.serializeDelta(delta));
		});
		var changeObserver = buffer.onDidChangeText((event) => {
			if(event.changes.length > 0) {
				if(!this.isIgnoringChanges()) {
					const changeQueue = this.getChangeQueueForEditor(editor.id);
					changeQueue.push({
						changes: event.changes,
					});
					this.sendChanges();
				}
			}
		});
		var grammarChangeObserver = editor.onDidChangeGrammar((grammar) => {
			const delta = {
				type: 'grammar',
				newGrammarName: editor.getGrammar().name,
				oldGrammarName: this.getCurrentGrammarFromDeltas(editor),
				id: editor.id
			};
			deltas.push(delta);
			this.emit('editor-event', this.serializeDelta(delta));
		});
		var modifiedObserver = buffer.onDidChangeModified((isModified) => {
			editorState.modified = isModified;
			const delta = {
				type: 'modified',
				id: editor.id,
				modified: isModified,
				oldModified: !isModified
			};
			this.emit('editor-event', this.serializeDelta(delta));
		});
		this.observers.push(cursorObservers, destroyObserver, titleObserver, changeObserver, grammarChangeObserver, modifiedObserver, selectionObservers);
	}
	serializeCursor(cursor) {
		const marker = cursor.getMarker();

		return {
			id: cursor.id,
			range: this.serializeRange(marker.getBufferRange())
		};
	}
	instrumentCursor(cursor, editor) {
		const editorState = this.getEditorState(editor);
				_.map(editor.getCursors(), (cursor) => {
					return this.serializeCursor(cursor);
				})
		var destroyObserver = cursor.onDidDestroy(() => {
			editorState.cursors = _.map(editor.getCursors(), (cursor) => {
				return this.serializeCursor(cursor);
			});
			this.emit('cursor-event', {
				type: 'destroy',
				editorID: editor.id,
				id: cursor.id
			});
		});
		var changePositionObserver = cursor.onDidChangePosition(_.throttle((event) => {
			editorState.cursors = _.map(editor.getCursors(), (cursor) => {
				return this.serializeCursor(cursor);
			});
			const marker = cursor.getMarker();

			this.emit('cursor-event', {
				id: cursor.id,
				editorID: editor.id,
				type: 'change-position',
				newRange: this.serializeRange(marker.getBufferRange()),
				oldBufferPosition: event.oldBufferPosition.serialize(),
				newBufferPosition: event.newBufferPosition.serialize(),
			});
		}, 300));
		this.observers.push(destroyObserver, changePositionObserver);
	}
	serializeRange(range) {
		return {
			start: range.start.serialize(),
			end: range.end.serialize()
		};
	}
	serializeChange(change) {
		return this.serializeChange(c);
	}
	destroy() {
		_.each(this.observers, (o) => {
			o.dispose();
		})
		this.observers = [];
	}

	serializeEditorState(state) {
		let serializedEditorState = _.extend({}, state, {
			deltas: _.map(state.deltas, (d) => {
				return this.serializeDelta(d);
			})
		});
		return _.omit(serializedEditorState, 'remoteCursorMarkerLayer');
	}

	serializeEditorStates() {
		const serializedStates = _.mapObject(this.editorStates, (state, id) => {
			return this.serializeEditorState(state);
		});
		return serializedStates;
	}
	getEditorState(editor) {
		let state;
		if(_.has(this.editorStates, editor.id)) {
			state = this.editorStates[editor.id];
		} else {
			state = {
				id: editor.id,
				deltas: [],
				modified: editor.isModified(),
				// remoteCursorMarkerLayer: editor.addMarkerLayer(),
				cursors: _.map(editor.getCursors(), (cursor) => {
					return this.serializeCursor(cursor);
				})
			};
			this.editorStates[editor.id] = state;
		}
		return state;
	}
	getDeltaHistory(editor, type) {
		let editorState = this.getEditorState(editor);
		return _.filter(editorState.deltas, (d) => {
			if(type) {
				if(_.isArray(type)) {
					return _.indexOf(type, d.type)>=0;
				} else {
					return d.type === type;
				}
			} else {
				return true;
			}
		});
	}
}
