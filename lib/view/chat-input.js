'use babel';

const $ = require('jquery');
const _ = require('underscore');
const EventEmitter = require('events');
const {Point,Range} = require('atom');
const escapeStringRegexp = require('escape-string-regexp');

const STATUS = {
    IDLE: 'IDLE',
    ACTIVE_TYPING: 'ACTIVE_TYPING',
    IDLE_TYPED: 'IDLE_TYPED'
};
const typingTimeout = 3000;

function trimString(str, size) {
    return str.length > size ? str.substring(0, size-3) + '...' : str;
}

export default class ChatWindowView extends EventEmitter {

    constructor(username) {
        super()
        this.activeTypingTimeout = -1;
        this.typingStatus = STATUS.IDLE;
        this.element = $('<div />', {class: 'chat-input'});
        this.chatInput = $('<atom-text-editor />', {
            attr: {
                'mini': 'mini'
            }
        });

        this.chatEditor = this.chatInput[0].getModel();
        this.chatEditor.setPlaceholderText('say something');

        this.chatInput.on('keydown', (event) => {
            if (event.keyCode === 13) {
                this.sendCurrentMessage();
                this.setTypingStatus(STATUS.IDLE);
                this.clearActiveTypingTimeout();
            }
        });

        this.chatEditor.onDidChange((event) => {
            const val = this.chatEditor.getText();
            if (val === '') {
                this.setTypingStatus(STATUS.IDLE);
                this.clearActiveTypingTimeout();
            } else {
                this.setTypingStatus(STATUS.ACTIVE_TYPING);
                this.resetActiveTypingTimeout();
            }
        });

        const selectionObservables = [];
        atom.workspace.observeActiveTextEditor((editor) => {
            // Clear all of the selection observables
            _.each(selectionObservables, (o) => { o.dispose(); })
            selectionObservables.splice(0, selectionObservables.length);

            if(editor) {
                selectionObservables.push.apply(this.addSelectionListeners(editor));
            }
        });

        this.element.append(this.chatInput);
    }

    addSelectionListeners(editor) {
        const disposeSelectionRangeEvent = editor.onDidChangeSelectionRange((event) => {
            const editorBuffer = editor.getBuffer();
            const range = event.newScreenRange;
            const {start, end} = range;

            let locationString;
            if(range.isEmpty()) {
                locationString = false;
            } else {
                const openFileTitle = atom.workspace.getActiveTextEditor().getTitle();
                if(start.column === 0 && end.column === 0) { // multi-full-line selection
                    if(start.row === end.row-1) { //selected one full line
                        locationString = `${openFileTitle}:L${start.row}`;
                    } else {
                        locationString = `${openFileTitle}:L${start.row}-L${end.row-1}`;
                    }
                } else {
                    locationString = `${openFileTitle}:L${start.row},${start.column}-L${end.row},${end.column}`;
                }
            }

            const currentMessage = this.chatEditor.getText();
            const chatEditorBuffer = this.chatEditor.getBuffer();
            const chatInputSelectionRange = this.chatEditor.getSelectedBufferRange();
            const messageRegex = new RegExp('\\[(.*)\\]\s*\\((.*)\\)');
            const messageMatch = currentMessage.match(messageRegex);

            let found = false;
            chatEditorBuffer.scan(messageRegex, {}, (info) => {
                const {computedRange, match, replace, stop} = info;
                const beforeChatInputSelectionRange = new Range(chatEditorBuffer.getFirstPosition(), computedRange.start);
                const afterChatInputSelectionRange = new Range(computedRange.end, chatEditorBuffer.getEndPosition());

                if(computedRange.intersectsWith(chatInputSelectionRange)) {
                    if(computedRange.isEqual(chatInputSelectionRange)) { // replace the text and the content
                        if(locationString) {
                            const textInRange = trimString(editor.getTextInBufferRange(range).replace(new RegExp('\n', 'g'), ' '), 10);
                            const newChatSelectionRange = replace(`[\`${textInRange}\`](${locationString})`);
                            this.chatEditor.setSelectedBufferRange(newChatSelectionRange);
                        } else {
                            replace('');
                        }
                    } else { // just replace the content
                        const textStr = match[1];
                        const previousLinkStr = match[2];
                        if(locationString) {
                            chatEditorBuffer.backwardsScanInRange(new RegExp(`\\(${escapeStringRegexp(previousLinkStr)}\\)`), computedRange, (i) => {
                                i.replace(`(${locationString})`);
                                i.stop();
                            });
                            chatEditorBuffer.scanInRange(new RegExp(`${escapeStringRegexp(textStr)}`), computedRange, (i) => {
                                this.chatEditor.setSelectedBufferRange(i.computedRange);
                                i.stop();
                            });
                        } else {
                            const replacedRange = replace(`${textStr}`);
                            this.chatEditor.setSelectedBufferRange(replacedRange);
                        }
                    }
                    found = true;
                    stop();
                }
            });

            if(locationString && !found) {
                if(chatInputSelectionRange.isEmpty()) {
                    const textInRange = trimString(editor.getTextInBufferRange(range).replace('\n', ' '), 10);
                    const insertedRange = chatEditorBuffer.setTextInRange(chatInputSelectionRange, `[\`${textInRange}\`](${locationString})`);
                    this.chatEditor.setSelectedBufferRange(insertedRange);
                } else {
                    const openBracketReplacementRange = chatEditorBuffer.insert(chatInputSelectionRange.start, `[`);
                    const endReplacementRange = chatEditorBuffer.insert(chatInputSelectionRange.end.translate([0,1]), `](${locationString})`);

                    const toSelectRange = new Range(openBracketReplacementRange.end, endReplacementRange.start);
                    this.chatEditor.setSelectedBufferRange(toSelectRange);
                }
            }
        });
        return [disposeSelectionRangeEvent];
    }

    sendCurrentMessage() {
        const toSend = this.chatEditor.getText();
        if (toSend.length > 0) {
            this.chatEditor.setText('');
            this.emit('sendTextMessage', {
                message: toSend
            });
        }
    }

    setTypingStatus(newStatus) {
        if (this.typingStatus != newStatus) {
            this.typingStatus = newStatus;
            this.emit('setTypingStatus', {
                status: this.typingStatus
            });
        }
        return this.typingStatus;
    };

    // Tear down any state and detach
    destroy() {
        this.element.remove();
    }

    getElement() {
        return this.element;
    }
    setActiveTypingTimeout() {
        this.activeTypingTimeout = window.setTimeout(() => {
            this.setTypingStatus(STATUS.IDLE_TYPED);
        }, typingTimeout);
    }
    clearActiveTypingTimeout() {
        if (this.hasActiveTypingTimeout()) {
            window.clearTimeout(this.activeTypingTimeout);
            this.activeTypingTimeout = -1;
        }
    }
    hasActiveTypingTimeout() {
        return this.activeTypingTimeout >= 0;
    }
    resetActiveTypingTimeout() {
        this.clearActiveTypingTimeout();
        this.setActiveTypingTimeout();
    }
}
