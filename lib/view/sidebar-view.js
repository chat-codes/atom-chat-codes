'use babel';

const $ = require('jquery');
const _ = require('underscore');
const EventEmitter = require('events');

export default class SidebarView extends EventEmitter {
    constructor(serializedState) {
        super();

        this.element = $('<div />', {text: 'code chat'});
        this.input = $('<textarea />', {}).appendTo(this.element).on('keydown', $.proxy(function(event) {
            if(event.keyCode === 13) {
                const {target} = event;
                const $target = $(target);
                const toSendText = $target.val();
                $target.val('');
                this.emit('sendTextMessage', {
                    message: toSendText
                });
            }
        }, this));
    }

    // Returns an object that can be retrieved when package is activated
    serialize() {}

    // Tear down any state and detach
    destroy() {
        this.element.remove();
    }

    getElement() {
        return this.element;
    }

}