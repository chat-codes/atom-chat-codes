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

        this.element = $('<div />', {class: 'chat-window'});
        this.connectingMessage = $('<span />', {text: 'Connecting to chat...'});
        this.element.append(this.connectingMessage);

		this.chatService = new ChatService(username);
        this.chatService.createChannel().then((channel) => {
            this.connectingMessage.remove();

            this.element = $('<div />', {class: 'chat-input'});
            this.channelName = $('<atom-text-editor />', {
                attr: {
                    'mini': 'mini'
                }
            });
            // this.channelName = $('<span />', {class: 'channel-name', text: channel.getURL()});

            this.disconnect = $('<button />', {text: 'Disconnect', class: 'disconnect btn'});
            this.channelInfo = $('<div />', {class: 'channel-info'});

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

            this.channelInfo.append(this.channelName, this.disconnect);
            this.element.append(this.channelInfo, this.members.getElement(), this.messages.getElement(), this.chatInput.getElement());
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
