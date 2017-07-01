'use babel';

const $ = require('jquery');
const _ = require('underscore');
const EventEmitter = require('events');
const CreateRoomView = require('./create-room');
const ChatWindowView = require('./chat-window');

export default class SidebarView extends EventEmitter {
    constructor(serializedState) {
        super();
        this.element = $('<div />');
        var username = serializedState && serializedState.username ? serializedState.username : '';
        this.showCreateRoom(username);
    }

    showChatWindow(username) {
        this.chatWindow = new ChatWindowView(username);
        this.element.append(this.chatWindow.getElement());

        this.chatWindow.on('disconnect', () => {
            this.hideChatWindow();
            this.showCreateRoom(this.username);
        });
    }
    hideChatWindow() {
        if(this.chatWindow) {
            this.chatWindow.getElement().remove();
            this.chatWindow.destroy();
            delete this.chatWindow;
        }
    }

    showCreateRoom(username) {
        this.createRoomView = new CreateRoomView(username);
        this.element.append(this.createRoomView.getElement());
        this.createRoomView.on('username-selected', (info) => {
            const {username} = info;
            this.hideCreateRoom();
            this.username = username;
            this.showChatWindow(username);
        });
    }

    hideCreateRoom() {
        if(this.createRoomView) {
            this.createRoomView.getElement().remove();
            this.createRoomView.destroy();
            delete this.createRoomView;
        }
    }

    // Returns an object that can be retrieved when package is activated
    serialize() {
        return {
            username: this.username || ''
        };
    }

    // Tear down any state and detach
    destroy() {
        this.element.remove();
    }


    getElement() {
        return this.element[0];
    }

}