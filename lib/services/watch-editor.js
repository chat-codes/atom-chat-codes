'use babel';

const _ = require('underscore');
const $ = require('jquery');
const EventEmitter = require('events');

const {Point,Range} = require('atom');


export default class WatchEditor extends EventEmitter {
	constructor(isMe, id, name, active) {
		super();
		this.editorStates = {};
		this.observers = [];
		this.ignoreChanges = false;
		this.changeQueues = {};
		this.markers = {};
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
					this.handleDelta(delta, false);
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
	handleCursorEvent(event) {
		const {uid,type,timestamp,remote,editorID} = event;
		const editor = this.getEditorWithID(editorID);
		const editorStates = this.editorStates[editorID];

		if(!_.has(this.markers, editorID)) {
			this.markers[editorID] = {};
		}
		if(!_.has(this.markers[editorID], uid)) {
			this.markers[editorID][uid] = {};
		}

		if(type === 'change-position') {
			const {newBufferPosition} = event;
			const pos = new Point(newBufferPosition[0], newBufferPosition[1]);
			const lineHeight = editor.getLineHeightInPixels();

			if(this.markers[editorID][uid].posMarker) {
				const {posMarker, posDecoration} = this.markers[editorID][uid];
				posMarker.setHeadBufferPosition(pos);
			} else {
				const posMarker = editor.markBufferPosition(pos, {
					invalidate: 'never'
				});
				const elem = $('<div />', {css: {
					top: -lineHeight+'px',
					height: lineHeight+'px'
				}, class: 'remoteCursor user-'+event.user.colorIndex});
				const posDecoration = editor.decorateMarker(posMarker, {
					type: 'overlay',
					// class: 'remoteCursor',
					item: elem[0]
				});
				_.extend(this.markers[editorID][uid], {
					posMarker: posMarker,
					posDecoration: posDecoration
				});
			}
		} else if(type === 'change-selection') {
			const {newRange} = event;
			const range = new Range(newRange.start, newRange.end);

			if(this.markers[editorID][uid].selectionMarker) {
				const {selectionMarker, selectionDecoration} = this.markers[editorID][uid];
				selectionMarker.setBufferRange(range);
			} else {
				const selectionMarker = editor.markBufferRange(range, {
					invalidate: 'never'
				});
				const selectionDecoration = editor.decorateMarker(selectionMarker, {
					type: 'highlight',
					class: 'user-'+event.user.colorIndex
				});
				_.extend(this.markers[editorID][uid], {
					selectionMarker: selectionMarker,
					selectionDecoration: selectionDecoration
				});
			}
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
			timestamp: this.getTimestamp()
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
				id: editor.id,
				timestamp: this.getTimestamp()
			};
			deltas.push(delta);
			this.emit('editor-event', this.serializeDelta(delta));
		});
		var titleObserver = editor.onDidChangeTitle(() => {
			const delta = {
				type: 'title',
				newTitle: editor.getTitle(),
				oldTitle: this.getCurrentTitleFromDeltas(editor),
				id: editor.id,
				timestamp: this.getTimestamp()
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
						timestamp: this.getTimestamp()
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
				id: editor.id,
				timestamp: this.getTimestamp()
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
				oldModified: !isModified,
				timestamp: this.getTimestamp()
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
	userRemoved(userID) {
		_.each(this.markers, (editorMarkers, editorID) => {
			if(editorMarkers[userID]) {
				const {posDecoration, selectionDecoration, selectionMarker, posMarker} = editorMarkers[userID];

				posDecoration.destroy();
				selectionDecoration.destroy();
				selectionMarker.destroy();
				posMarker.destroy();
				delete editorMarkers[userID];
			}
		});
	}
	destroy() {
		_.each(this.observers, (o) => {
			o.dispose();
		})
		this.observers = [];
	}

	updatePositionsFromAnchor(delta) {
		if(delta.oldRangeAnchor && delta.newRangeAnchor) {
			const oldRange = delta.oldRangeAnchor.getBufferRange();
			const newRange = delta.newRangeAnchor.getBufferRange();

			delta.oldRange.start = [oldRange.start.row, oldRange.start.column];
			delta.oldRange.end = [oldRange.end.row, oldRange.end.column];
			delta.newRange.start = [newRange.start.row, newRange.start.column];
			delta.newRange.end = [newRange.end.row, newRange.end.column];
		}
		return delta;
	}
	getAnchoredDelta(change, editor) {
		const oldRangeAnchor = editor.markBufferRange(new Range(change.oldRange.start, change.oldRange.end), {});
		const newRangeAnchor = editor.markBufferRange(new Range(change.newRange.start, change.newRange.end), {});

		const anchoredChange = _.extend({
			oldRangeAnchor: oldRangeAnchor,
			newRangeAnchor: newRangeAnchor
		}, change);

		setTimeout(() => {
			delete anchoredChange.oldRangeAnchor;
			delete anchoredChange.newRangeAnchor;
			oldRangeAnchor.destroy();
			newRangeAnchor.destroy();
		}, 2000);
		return anchoredChange;
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
	saveFile(event) {
        var editor;
        atom.textEditors.editors.forEach((e) => {
            if(e.id === event.id) {
                editor = e;
            }
        });
		editor.save();
	}
	handleDelta(event, mustPerformChange) {
		if(mustPerformChange===undefined) { mustPerformChange = true; }
		const {type, id} = event;
		const editor = this.getEditorWithID(id);
		if(type === 'edit') {
			const anchoredChanges = _.map(event.changes, (delta) => { return this.getAnchoredDelta(delta, editor) });
			event.changes = anchoredChanges;
		}
		const editorState = this.getEditorState(editor);
		const deltas = editorState.deltas;
		let i = deltas.length-1;
		let d;
		for(; i>=0; i--) {
			d = deltas[i];
			if(d.timestamp > event.timestamp) {
				this.undoDelta(d);
			} else {
				break;
			}
		}
		const insertAt = i+1;
		deltas.splice(insertAt, 0, event);

		if(mustPerformChange) {
			i = insertAt;
		} else {
			i = insertAt + 1;
		}

		for(; i<deltas.length; i++) {
			d = deltas[i];
			this.doDelta(d);
		}
	}
	getEditorWithID(editorID) {
		let editor = null;
        atom.textEditors.editors.forEach((e) => {
            if(e.id === editorID) {
                editor = e;
            }
        });
		return editor;
	}
	doDelta(delta) {
        const {type, id} = delta;
		const editor = this.getEditorWithID(id);

		if(type === 'edit') {
			this.beginIgnoringChanges();
			_.each(delta.changes, (c) => {
				this.updatePositionsFromAnchor(c);
				const {newText} = c;
		        const oldRange = new Range(c.oldRange.start, c.oldRange.end);
		        editor.setTextInBufferRange(oldRange, newText);
			});
			this.endIgnoringChanges();
		}
	}
	undoDelta(delta) {
        const {id, type} = delta;
		const editor = this.getEditorWithID(id);

		if(type === 'edit') {
			this.beginIgnoringChanges();
			_.each(delta.changes, (c) => {
		        const {oldText} = c;
		        const newRange = new Range(c.newRange.start, c.newRange.end);

		        editor.setTextInBufferRange(newRange, oldText);
			});
			this.endIgnoringChanges();
		}
	}
	getTimestamp() {
		return (new Date()).getTime();
	}
}
