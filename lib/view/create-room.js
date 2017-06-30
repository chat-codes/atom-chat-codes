'use babel';

const $ = require('jquery');
const _ = require('underscore');
const EventEmitter = require('events');

export default class CreateRoomView extends EventEmitter {
    constructor() {
        super();
        this.element = $('<div />', {class: 'create-room'});

        this.form = $('<form />').appendTo(this.element);

        this.explanationElement = $('<p/>', {text: 'Specify a handle and create a room'});
        this.usernameElement = $('<atom-text-editor />',
            {class: 'editor', attr: {'mini': 'mini', 'data-grammar': 'text palin null-grammar', 'placeholder-text': 'Enter your user name'}});
        this.startTalkingElement = $('<button />',
            {class: 'btn btn-primary btn-lg icon icon-comment-discussion', text: 'Create Room', attr: {type: 'submit'}});

        this.usernameElement.on('keydown', (event) => {
            if(event.keyCode === 13) { // Enter
                this.doSubmit();
            }
        });

        this.usernameElement.on('didChange', (event) => {
            console.log('change');
        });

        this.form.on('submit', (event) => {
            this.doSubmit();
        });


        this.form.append(this.explanationElement, this.usernameElement, this.startTalkingElement);
    }

    doSubmit() {
        const username = this.getUsernameValue();
        console.log(username);
    }

    getUsernameValue() {
        return this.usernameElement.val();
    }

    checkUsername() {

    }

    // Tear down any state and detach
    destroy() {
        this.element.remove();
    }

    getElement() {
        return this.element;
    }

}
