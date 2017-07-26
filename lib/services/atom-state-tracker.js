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
        this.editorWatcher.on('open-editor', (e) => {
            this.channelCommunicationService.emitEditorOpened(e, false);
        });
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
		const mark = this.editor.markBufferRange(new Range(range.start, range.end));
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
		const {uid,type,timestamp,remote,editorID,pos,user} = cursor;
		const editor = this.editor;

		if(!_.has(this.markers, editorID)) {
			this.markers[editorID] = {};
		}
		if(!_.has(this.markers[editorID], uid)) {
			this.markers[editorID][uid] = {};
		}
		if(cursor.pos) {
			this.updateRemoteCursorPosition(cursor, remoteCursorMarker);
		}
		if(cursor.range) {
			this.updateRemoteCursorSelection(cursor, remoteCursorMarker);
		}
	}
	updateRemoteCursorPosition(cursor, remoteCursorMarker) {
		const {uid,timestamp,remote,editorID,pos,user} = cursor;
		const editor = this.editor;
		const atomPos = new Point(pos.row, pos.column);

		if(this.markers[editorID][uid].posMarker) {
			const {posMarker, posDecoration} = this.markers[editorID][uid];
			posMarker.setHeadBufferPosition(atomPos);
		} else {
			const lineHeight = editor.getLineHeightInPixels();
			const posMarker = editor.markBufferPosition(atomPos, {
				invalidate: 'never'
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
			_.extend(this.markers[editorID][uid], {
				posMarker: posMarker,
				posDecoration: posDecoration
			});
		}
	}
	updateRemoteCursorSelection(cursor, remoteCursorMarker) {
		const {uid,type,timestamp,remote,editorID,range,user} = cursor;
		const editor = this.editor;
		const atomRange = new Range(range.start, range.end);


		if(this.markers[editorID][uid].selectionMarker) {
			const {selectionMarker, selectionDecoration} = this.markers[editorID][uid];
			selectionMarker.setBufferRange(atomRange);
		} else {
			const selectionMarker = editor.markBufferRange(atomRange, {
				invalidate: 'never'
			});
			const selectionDecoration = editor.decorateMarker(selectionMarker, {
				type: 'highlight',
				class: 'user-'+user.colorIndex
			});
			_.extend(this.markers[editorID][uid], {
				selectionMarker: selectionMarker,
				selectionDecoration: selectionDecoration
			});
		}
	}
	removeRemoteCursor(cursor, remoteCursorMarker) {
		const {uid,type,timestamp,remote,editorID,range,user} = cursor;
		const {posDecoration, selectionDecoration, selectionMarker, posMarker} = editorMarkers[editorID][userID];

		posDecoration.destroy();
		selectionDecoration.destroy();
		selectionMarker.destroy();
		posMarker.destroy();
		delete this.editorMarkers[userID][uid];
	}
}