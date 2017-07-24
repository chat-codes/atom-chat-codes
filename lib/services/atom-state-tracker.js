'use babel';
const est = require('chat-codes-services/built/editor-state-tracker');
const {EditorStateTracker,EditorState} = est;
const {Point,Range} = require('atom');

class AtomEditorWrapper {
	constructor(state) {
	}
	public setGrammar(grammarName:string) { }
	public replaceText(serializedRange, value:string) {
        const range = this.getRangeFromSerializedRange(serializedRange);
		this.editor.setTextInBufferRange(range, value);
	}
	public setText(value:string) { }
	public getAnchor(range) {
		const doc = this.session.getDocument();
		return {
			start: this.getAnchorFromLocation(doc, range.start),
			end: this.getAnchorFromLocation(doc, range.end)
		};
	}
	public getCurrentAnchorPosition(anchor) {
		return {
			start: [anchor.start.row, anchor.start.column],
			end: [anchor.end.row, anchor.end.column]
		};
	}
	private getRangeFromSerializedRange(serializedRange) {
		return new Range(serializedRange.start, serializedRange.end);
	}
	private getAnchorFromLocation(doc, loc) {
		const Anchor = ace.acequire('ace/anchor').Anchor;
		return new Anchor(doc, loc[0],loc[1]);
	}
}

export default class AtomEditorStateTracker extends EditorStateTracker {
	constructor() {
		super((state) => {
			return new AtomEditorWrapper(state);
		});
	}
}
