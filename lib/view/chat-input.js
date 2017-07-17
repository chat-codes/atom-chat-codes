'use babel';

const $ = require('jquery');
const _ = require('underscore');
const EventEmitter = require('events');

const STATUS = {
    IDLE: 'IDLE',
    ACTIVE_TYPING: 'ACTIVE_TYPING',
    IDLE_TYPED: 'IDLE_TYPED'
};
const typingTimeout = 3000;

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

        this.element.append(this.chatInput);
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