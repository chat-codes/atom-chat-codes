'use babel';

const $ = require('jquery');
const _ = require('underscore');
const EventEmitter = require('events');
const MAX_LENGTH = 40;

export default class CreateRoomView extends EventEmitter {
    constructor(initialValue) {
        super();
        this.element = $('<div />', {class: 'create-room'});

        this.form = $('<form />').appendTo(this.element);

        this.explanationElement = $('<p/>', {text: 'Specify a handle and create a room'});
        this.usernameElement = $('<atom-text-editor />',
            {class: 'editor', attr: {'mini': 'mini', 'data-grammar': 'text palin null-grammar'}});
        this.model = this.usernameElement[0].getModel();
        this.model.setPlaceholderText('Enter your user name');
        if(initialValue) {
            this.model.setText(initialValue);
        }
        this.usernameFeedback = $('<div />');

        this.model.onDidChange((event) => {
            this.checkUsername();
        });

        this.startTalkingElement = $('<button />',
            {class: 'btn btn-primary btn-lg icon icon-comment-discussion', text: 'Create Room', attr: {type: 'submit'}});

        this.usernameElement.on('keydown', (event) => {
            if(event.keyCode === 13) { // Enter
                this.doSubmit();
            }
        });

        this.form.on('submit', (event) => {
            this.doSubmit();
        });


        this.form.append(this.explanationElement, this.usernameElement, this.usernameFeedback, this.startTalkingElement);
    }

    doSubmit() {
        const username = this.getUsernameValue();
        if(this.checkUsername()) {
            this.emit('username-selected', {
                username: username
            });
        }
    }

    getUsernameValue() {
        return this.model.getText().trim();
    }

    checkUsername() {
        const usernameValue = this.getUsernameValue();
        var isValid;
        if(usernameValue.length === 0) {
            this.usernameFeedback.text('Must be ' + 0 + ' characters or more.')
            isValid = false;
        } else if(usernameValue.length > MAX_LENGTH) {
            this.usernameFeedback.text('Must be ' + MAX_LENGTH + ' characters or fewer.')
            isValid = false;
        } else {
            this.usernameFeedback.text('');
            isValid = true;
        }

        if(isValid) {
            this.usernameFeedback.removeClass('text-error');
            this.startTalkingElement.removeClass('disabled');
        } else {
            this.usernameFeedback.addClass('text-error');
            this.startTalkingElement.addClass('disabled');
        }

        return isValid;
    }

    // Tear down any state and detach
    destroy() {
        this.element.remove();
    }

    getElement() {
        return this.element;
    }

}
