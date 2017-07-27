'use babel';

const _ = require('underscore');
const $ = require('jquery');
const EventEmitter = require('events');

const {Point,Range} = require('atom');


export class WatchEditor extends EventEmitter {
	constructor(editor) {
		super();
		this.editor = editor;
		this.observers = [];
		this.ignoreChanges = false;
		this.changeQueue = [];
		this.sendChanges = _.debounce(() => {
			const changeQueue = this.changeQueue;
			if(changeQueue.length > 0) {
				const changes = _	.chain(changeQueue)
									.pluck('changes')
									.flatten(true)
									.map((c) => {
										return {
											newRange: this.serializeRange(c.newRange),
											oldRange: this.serializeRange(c.oldRange),
											newText: c.newText,
											oldText: c.oldText
										};
									})
									.value();
				const lastChange = _.last(changeQueue);
				const delta = {
					type: 'edit',
					id: editor.id,
					timestamp: lastChange.timestamp,
					changes: changes
				};
				this.emit('editor-event', this.serializeDelta(delta));
			}
			this.changeQueue = [];
		}, 50);
	}
	ready() {
		this.instrumentEditor(this.editor);
		// var teObserver = atom.workspace.observeTextEditors((editor) => {
		// 	this.instrumentEditor(editor);
        // });
		// this.observers.push(teObserver);
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
		const buffer = editor.getBuffer();

		this.currentGrammarName = editor.getGrammar().name;
		this.currentTitle = editor.getTitle();

		const openDelta =  {
			type: 'open',
			id: editor.id,
			contents: editor.getText(),
			grammarName: this.currentGrammarName,
			title: this.currentTitle,
			modified: editor.isModified()
		};
		this.emit('editor-event', openDelta);

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
			this.emit('editor-event', this.serializeDelta(delta));
		});
		var titleObserver = editor.onDidChangeTitle(() => {
			const title = editor.getTitle();
			const delta = {
				type: 'title',
				newTitle: title,
				oldTitle: this.currentTitle,
				id: editor.id
			};
			this.currentTitle = title;
			this.emit('editor-event', this.serializeDelta(delta));
		});
		var changeObserver = buffer.onDidChangeText((event) => {
			if(event.changes.length > 0) {
				if(!this.isIgnoringChanges()) {
					this.changeQueue.push({
						changes: event.changes,
					});
					this.sendChanges();
				}
			}
		});
		var grammarChangeObserver = editor.onDidChangeGrammar((grammar) => {
			const grammarName = editor.getGrammar().name;
			const delta = {
				type: 'grammar',
				newGrammarName: grammarName,
				oldGrammarName: this.currentGrammarName,
				id: editor.id
			};
			this.currentGrammarName = grammarName;
			this.emit('editor-event', this.serializeDelta(delta));
		});
		var modifiedObserver = buffer.onDidChangeModified((isModified) => {
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
		var destroyObserver = cursor.onDidDestroy(() => {
			this.emit('cursor-event', {
				type: 'destroy',
				editorID: editor.id,
				id: cursor.id
			});
		});
		var changePositionObserver = cursor.onDidChangePosition(_.throttle((event) => {
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
}
