'use babel';

import ChatService from './services/chat-service';
import CodeChatView from './view/sidebar-view';
import { CompositeDisposable } from 'atom';

export default {

	codeChatView: null,
	modalPanel: null,
	subscriptions: null,

	activate(state) {
		this.chatService = new ChatService();
		var channel = this.chatService.createChannel();
		channel.getURL().then(function(url) {
			console.log(url);
		});
		// channel.postTextMessage('hello world');
		this.codeChatView = new CodeChatView(state.codeChatViewState);
		this.codeChatView.on('sendTextMessage', function(data) {
			const {message} = data;
			channel.postTextMessage(message);
		});
		this.chatView = atom.workspace.addRightPanel({
			item: this.codeChatView.getElement(),
			visible: false
		});
		// Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
		this.subscriptions = new CompositeDisposable();

		// Register command that toggles this view
		this.subscriptions.add(atom.commands.add('atom-workspace', {
			'code-chat:toggle': () => this.toggle()
		}));
	},

	deactivate() {
		this.chatView.destroy();
		this.subscriptions.dispose();
		this.codeChatView.destroy();
	},

	serialize() {
		return {
			codeChatViewState: this.codeChatView.serialize()
		};
	},

	toggle() {
		console.log('CodeChat was toggled!');
		return (
			this.modalPanel.isVisible() ?
			this.modalPanel.hide() :
			this.modalPanel.show()
		);
	}

};