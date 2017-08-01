'use babel';

const {EditorStateTracker,EditorState} = require('chat-codes-services/built/editor-state-tracker');
const {Point,Range} = require('atom');
const {WatchEditor} = require('./watch-editor');
const _ = require('underscore');
const $ = require('jquery');

export class AtomEditorWrapper {
	constructor(state, channelCommunicationService) {
		const {id} = state;
		this.channelCommunicationService = channelCommunicationService;

		this.editor = this.getEditorWithID(id);
		this.editorWatcher = new WatchEditor(this.editor);
		this.markers = {};

		this.editorWatcher.on('editor-event', (e) => {
            this.channelCommunicationService.emitEditorChanged(e, false);
        });
        this.editorWatcher.on('cursor-event', (e) => {
            this.channelCommunicationService.emitCursorPositionChanged(e, false);
        });
        // this.editorWatcher.on('open-editor', (e) => {
        //     this.channelCommunicationService.emitEditorOpened(e, false);
        // });
		this.channelCommunicationService.ready().then(() => {
			this.editorWatcher.ready();
		});
	}
	setEditorState(editorState) {
		this.editorState = editorState;
	};
	setGrammar(grammarName) { }
	replaceText(serializedRange, value) {
		this.editorWatcher.beginIgnoringChanges();
        const range = this.getRangeFromSerializedRange(serializedRange);
		this.editor.setTextInBufferRange(range, value);
		this.editorWatcher.endIgnoringChanges();
	}
	setText(value) {
		this.editorWatcher.beginIgnoringChanges();
		this.editor.setText(value);
		this.editorWatcher.endIgnoringChanges();
	}
	getAnchor(range) {
		const mark = this.editor.markBufferRange(new Range(range.start, range.end), {
			invalidate: 'touch'
		});
		return mark;
	}
	getCurrentAnchorPosition(anchor) {
		const range = anchor.getBufferRange();
		return {
			start: [range.start.row, range.start.column],
			end: [range.end.row, range.end.column]
		};
	}
	getRangeFromSerializedRange(serializedRange) {
		return new Range(serializedRange.start, serializedRange.end);
	}
	getAnchorFromLocation(doc, loc) {
		const Anchor = ace.acequire('ace/anchor').Anchor;
		return new Anchor(doc, loc[0],loc[1]);
	}
	saveFile(event) {
		this.editor.save();
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
	addRemoteCursor(cursor, remoteCursorMarker) {
		const {user} = cursor;
		const uid = user.id;

		if(!_.has(this.markers, uid)) {
			this.markers[uid] = {};
		}
	}
	addRemoteCursorPosition(cursor, remoteCursorMarker) {
		const {user, pos} = cursor;
		const uid = user.id;
		const editor = this.editor;
		const atomPos = new Point(pos.row, pos.column);
		const marker = this.markers[uid];

		const lineHeight = editor.getLineHeightInPixels();
		const posMarker = editor.markBufferPosition(atomPos, {
			// invalidate: 'touch'
		});
		const elem = $('<div />', {css: {
			top: -lineHeight+'px',
			height: lineHeight+'px'
		}, class: 'remoteCursor user-'+user.colorIndex});
		const posDecoration = editor.decorateMarker(posMarker, {
			type: 'overlay',
			// class: 'remoteCursor',
			item: elem[0]
		});
		_.extend(marker, {
			posMarker: posMarker,
			posDecoration: posDecoration
		});
	}
	updateRemoteCursorPosition(cursor, remoteCursorMarker) {
		const {user, pos} = cursor;
		const uid = user.id;
		const atomPos = new Point(pos.row, pos.column);
		const marker = this.markers[uid];

		const {posMarker, posDecoration} = marker;
		posMarker.setHeadBufferPosition(atomPos);
	}
	addRemoteCursorSelection(cursor, remoteCursorMarker) {
		this.updateRemoteCursorSelection(cursor, remoteCursorMarker);
	}
	updateRemoteCursorSelection(cursor, remoteCursorMarker) {
		const {user, range} = cursor;
		const uid = user.id;
		const atomRange = new Range(range.start, range.end);

		const marker = this.markers[uid];
		let selectionMarker = marker.selectionMarker;

		if(atomRange.isEmpty()) {
			if(selectionMarker) {
				this.removeRemoteSelection(cursor, remoteCursorMarker);
			}
		} else {
			if(selectionMarker) {
				selectionMarker.setBufferRange(atomRange);
			} else {
				const editor = this.editor;
				selectionMarker = editor.markBufferRange(atomRange, { });
				const selectionDecoration = editor.decorateMarker(selectionMarker, {
					type: 'highlight',
					class: 'user-'+user.colorIndex
				});
				_.extend(marker, {
					selectionMarker: selectionMarker,
					selectionDecoration: selectionDecoration
				});
			}
		}
	}
	removeRemoteSelection(cursor, remoteCursorMarker) {
		const {user, range} = cursor;
		const uid = user.id;
		const marker = this.markers[uid];
		const {selectionDecoration, selectionMarker} = marker;

		if(selectionDecoration) {
			selectionDecoration.destroy();
			delete marker.selectionDecoration;
		}
		if(selectionMarker) {
			selectionMarker.destroy();
			delete marker.selectionMarker;
		}
	}
	removeRemotePosition(cursor, remoteCursorMarker) {
		const {user, range} = cursor;
		const uid = user.id;
		const marker = this.markers[uid];
		const {posDecoration, posMarker} = marker;

		if(posDecoration) {
			posDecoration.destroy();
			delete marker.posDecoration;
		}
		if(posMarker) {
			posMarker.destroy();
			delete marker.posMarker;
		}
	}
	removeRemoteCursor(cursor, remoteCursorMarker) {
		const {user, range} = cursor;
		const uid = user.id;

		this.removeRemoteSelection(cursor, remoteCursorMarker);
		this.removeRemotePosition(cursor, remoteCursorMarker);

		delete this.markers[uid];
	}
}