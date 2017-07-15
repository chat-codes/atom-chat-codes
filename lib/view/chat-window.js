'use babel';

const $ = require('jquery');
const EventEmitter = require('events');
import ChatService from '../services/chat-service';
import ChatInput from './chat-input';
import MembersView from './members'
import MessagesView from './messages'

export default class ChatWindowView extends EventEmitter {

    constructor(username) {
        super();

        this.element = $('<div />');
        this.connectingMessage = $('<span />', {text: 'Connecting to chat...'});
        this.element.append(this.connectingMessage);

		this.chatService = new ChatService(username);
        this.chatService.createChannel().then((channel) => {
            this.connectingMessage.remove();
            this.channelName = $('<span />', {text: channel.getURL()});

            this.disconnect = $('<button />', {text: 'Disconnect', class: 'btn'});
            this.disconnect.on('click', (event) => {
                this.emit('disconnect');
            });

            this.messages = new MessagesView(channel);
            this.members = new MembersView(channel);

            this.chatInput = new ChatInput();
            this.chatInput.on('sendTextMessage', (data) => {
                channel.postTextMessage(data.message);
            });
            this.chatInput.on('setTypingStatus', (data) => {
                channel.sendTypingStatus(data.status);
            });

            this.element.append(this.channelName, this.disconnect, this.members.getElement(), this.messages.getElement(), this.chatInput.getElement());
        }, function(err) {
            console.error(err.stack);
        });
    }

    // Tear down any state and detach
    destroy() {
        this.chatService.destroy();
        this.element.remove();
    }

    getElement() {
        return this.element;
    }

}
