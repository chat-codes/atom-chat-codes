'use babel';

const $ = require('jquery');
const EventEmitter = require('events');
import ChatInput from './chat-input';
import MembersView from './members'
import MessagesView from './messages'
import {AtomCommunicationService} from '../services/atom-communication-service';
import {getAtomStateTracker} from '../services/atom-state-tracker';
import {WatchEditor} from '../services/watch-editor';

export default class ChatWindowView extends EventEmitter {

    constructor(username) {
        super();

        // this.editorWatcher = getAtomStateTracker();
        this.stateTracker = getAtomStateTracker();
		this.editorWatcher = new WatchEditor();
		this.commLayer = new AtomCommunicationService(username);
        this.typingMessages = {};
        this.element = $('<div />', {class: 'chat-window'});
        this.connectingMessage = $('<span />', {text: 'Connecting to chat...'});
        this.element.append(this.connectingMessage);

        this.commLayer.ready().then((channelService) => {
    		this.editorWatcher.on('editor-event', (e) => {
                channelService.emitEditorChanged(e, false);
            });
            this.editorWatcher.on('cursor-event', (e) => {
                channelService.emitCursorPositionChanged(e, false);
            });
            this.editorWatcher.on('open-editor', (e) => {
                channelService.emitEditorOpened(e);
            });
            this.editorWatcher.ready();

    		channelService.on('editor-event', (event) => {
    			this.stateTracker.handleEvent(event);
    		});

            this.connectingMessage.remove();
            this.channelName = $('<span />', {class: 'channel-name', text: channelService.getURL()}).on('click', (event) => {
                // let selection = window.getSelection();
                // let range = document.createRange();
                // range.selectNodeContents(event.target);
                // selection.removeAllRanges();
                // selection.addRange(range);
            });
            this.disconnect = $('<button />', {text: 'Disconnect', class: 'disconnect btn'});
            this.channelInfo = $('<div />', {class: 'channel-info'});

            this.disconnect.on('click', (event) => {
                this.emit('disconnect');
            });

            this.messages = new MessagesView(channelService);
            this.members = new MembersView(channelService);

            this.chatInput = new ChatInput();
            this.chatInput.on('sendTextMessage', (data) => {
                channelService.sendTextMessage(data.message);
            });
            this.chatInput.on('setTypingStatus', (data) => {
                channelService.sendTypingStatus(data.status);
            });

            this.channelInfo.append(this.channelName, this.disconnect);
            this.element.append(this.channelInfo, this.members.getElement(), this.messages.getElement(), this.chatInput.getElement());
        }).catch(function(err) {
            console.error(err.stack);
        });
    }

    // Tear down any state and detach
    destroy() {
        this.commLayer.destroy();
        this.element.remove();
    }

    getElement() {
        return this.element;
    }

}
