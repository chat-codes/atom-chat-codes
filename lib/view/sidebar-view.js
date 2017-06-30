'use babel';

const $ = require('jquery');
const _ = require('underscore');
const EventEmitter = require('events');
const CreateRoomView = require('./create-room');

export default class SidebarView extends EventEmitter {
    constructor(serializedState) {
        super();
        this.element = $('<div />');
        this.showCreateRoom();

        // this.input = $('<textarea />', {}).appendTo(this.element).on('keydown', $.proxy(function(event) {
        //     if(event.keyCode === 13) {
        //         const {target} = event;
        //         const $target = $(target);
        //         const toSendText = $target.val();
        //         $target.val('');
        //         this.emit('sendTextMessage', {
        //             message: toSendText
        //         });
        //     }
        // }, this));
    }

    showCreateRoom() {
        this.createRoomView = new CreateRoomView();
        this.element.append(this.createRoomView.getElement());
    }

    hideCreateRoom() {
        if(this.createRoomView) {
            this.createRoomView.getElement().remove();
            this.createRoomView.destroy();
        }
    }

    // Returns an object that can be retrieved when package is activated
    serialize() {}

    // Tear down any state and detach
    destroy() {
        this.element.remove();
    }


    getElement() {
        return this.element[0];
    }

}