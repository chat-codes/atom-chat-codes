'use babel';

const $ = require('jquery');
import ChatService from '../services/chat-service';
import ChatInput from './chat-input'

export default class ChatWindowView {

    constructor(username) {
        this.element = $('<div />');
        this.connectingMessage = $('<span />', {text: 'Connecting to chat...'});
        this.element.append(this.connectingMessage);

		this.chatService = new ChatService(username);
        this.chatService.createChannel().then((channel) => {
            this.connectingMessage.remove();
            this.channelName = $('<span />', {text: channel.getURL()});

    		var channel = this.chatService.createChannel();

            this.chatInput = new ChatInput();
            this.chatInput.on('sendTextMessage', (data) => {
                channel.sendTextMessage(data.message);
            });
            this.chatInput.on('setTypingStatus', (data) => {
                channel.setTypingStatus(data.status);
            });

            this.element.append(thi.channelName, this.chatInput.getElement());
        }, function(err) {
            console.error(err);
        });



		// this.codeChatView.on('sendTextMessage', function(data) {
		// 	const {message} = data;
		// 	channel.postTextMessage(message);
		// });

        //  #(
        //
        // )
        // this.explanationElement = $('<p/>', {text: 'Specify a handle and create a room'});
        // this.usernameElement = $('<atom-text-editor />',
        //     {class: 'editor', attr: {'mini': 'mini', 'data-grammar': 'text palin null-grammar'}});
        // this.model = this.usernameElement[0].getModel();
        // this.model.setPlaceholderText('Enter your user name');
        // console.log(initialValue);
        // if(initialValue) {
        //     this.model.setText(initialValue);
        // }
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

    // Tear down any state and detach
    destroy() {
        this.element.remove();
    }

    getElement() {
        return this.element;
    }

}
