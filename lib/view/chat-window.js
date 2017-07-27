'use babel';

const $ = require('jquery');
const EventEmitter = require('events');
import ChatInput from './chat-input';
import MembersView from './members'
import MessagesView from './messages'
import {AtomCommunicationService} from '../services/atom-communication-service';
import { TerminalView } from './terminal';
// import {WatchEditor} from '../services/watch-editor';

export default class ChatWindowView extends EventEmitter {

    constructor(username) {
        super();

        // this.editorWatcher = getAtomStateTracker();
		// this.editorWatcher = new WatchEditor();
		this.commLayer = new AtomCommunicationService(username);
        this.typingMessages = {};
        this.element = $('<div />', {class: 'chat-window'});
        this.connectingMessage = $('<span />', {text: 'Connecting to chat...'});
        this.element.append(this.connectingMessage);

		let teObserver = atom.workspace.observeTextEditors((editor) => {
            this.commLayer.channelServicePromise.then((channelService) => {
                channelService.emitEditorOpened({
                    id: editor.id
                });
                // channelService.editorStateTracker.onEditorOpened({
                //     id: editor.id
                // }, false);
            });
        });

        this.commLayer.ready().then((channelService) => {
            // this.editorWatcher.ready();

    		// this.commLayer.on('editor-event', (event) => {
    		// 	this.stateTracker.handleEvent(event);
    		// });
    		// this.commLayer.on('cursor-event', (event) => {
    		// 	const {id, type, uid} = event;
    		// 	let userList:ChatUserList = this.commLayer.userList;
    		// 	let user = userList.getUser(uid);
            //
    		// 	if(type === 'change-position') {
    		// 		const {newBufferPosition, oldBufferPosition, newRange, id, editorID} = event;
    		// 		// const editorState = this.editorWatcher.getEditorState(event);
            //     	// const editor = this.editorWatcher.getEditorWithID(editorID);
    		// 		const editorState = this.stateTracker.getEditorState(editorID);
    		// 		if(editorState) {
    		// 			const remoteCursors = editorState.getRemoteCursors();
    		// 			remoteCursors.updateCursor(id, user, {row: newBufferPosition[0], column: newBufferPosition[1]});
    		// 		}
    		// 	} else if(type === 'change-selection') {
    		// 		const {newRange, id, editorID} = event;
    		// 		// const editorState = this.editorStateTracker.getEditorState(editorID);
            //     	// const editor = this.editorWatcher.getEditorWithID(editorID);
    		// 		const editorState = this.stateTracker.getEditorState(editorID);
    		// 		if(editorState) {
    		// 			const remoteCursors = editorState.getRemoteCursors();
    		// 			remoteCursors.updateSelection(id, user, newRange);
    		// 		}
    		// 	} else if(type === 'destroy') {
    		// 		console.log(event);
    		// 	}
            // });


            this.connectingMessage.remove();
            this.channelName = $('<span />', {class: 'channel-name', text: channelService.getURL()}).on('click', (event) => {
                // let selection = window.getSelection();
                // let range = document.createRange();
                // range.selectNodeContents(event.target);
                // selection.removeAllRanges();
                // selection.addRange(range);
            });
            this.terminalView = new TerminalView(channelService);

            this.toggleTerminal = $('<button />', {text: 'terminal', class: 'toggle-terminal btn'});
            this.updateTerminalView();
            this.disconnect = $('<button />', {text: 'Disconnect', class: 'disconnect btn'});
            this.channelInfo = $('<div />', {class: 'channel-info'});

            this.disconnect.on('click', (event) => {
                this.emit('disconnect');
            });
            this.toggleTerminal.on('click', (event) => {
                this.toggleTerminal.toggleClass('showing');
                this.updateTerminalView();
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

            this.channelInfo.append(this.channelName, this.disconnect, this.toggleTerminal);
            this.element.append(this.channelInfo, this.terminalView.getElement(), this.members.getElement(), this.messages.getElement(), this.chatInput.getElement());
        }).catch(function(err) {
            console.error(err.stack);
        });
    }

    // Tear down any state and detach
    destroy() {
        this.commLayer.destroy();
        this.element.remove();
    }

    updateTerminalView() {
        if(this.toggleTerminal.hasClass('showing')) {
            this.toggleTerminal.text('Hide terminal')
            this.terminalView.show();
        } else {
            this.toggleTerminal.text('Show terminal')
            this.terminalView.hide();
        }
    }

    getElement() {
        return this.element;
    }

}
