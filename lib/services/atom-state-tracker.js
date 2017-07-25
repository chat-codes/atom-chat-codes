'use babel';

const {EditorStateTracker,EditorState} = require('chat-codes-services/built/editor-state-tracker');
const {Point,Range} = require('atom');
const {WatchEditor} = require('./watch-editor');

class AtomEditorWrapper {
	constructor(state) {
	}
	setEditorState(editorState) {
		this.editorState = editorState;
	};
	setGrammar(grammarName) { }
	replaceText(serializedRange, value) {
		console.log(serializedRange);
		console.log(value);
        const range = this.getRangeFromSerializedRange(serializedRange);
		this.editor.setTextInBufferRange(range, value);
	}
	setText(value) { }
	getAnchor(range) {
		const doc = this.session.getDocument();
		return {
			start: this.getAnchorFromLocation(doc, range.start),
			end: this.getAnchorFromLocation(doc, range.end)
		};
	}
	getCurrentAnchorPosition(anchor) {
		return {
			start: [anchor.start.row, anchor.start.column],
			end: [anchor.end.row, anchor.end.column]
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
        var editor;
        atom.textEditors.editors.forEach((e) => {
            if(e.id === event.id) {
                editor = e;
            }
        });
		editor.save();
	}
}

export function getAtomStateTracker() {
	return new EditorStateTracker((state) => {
		return new AtomEditorWrapper(state);
	});
}
